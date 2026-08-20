import type { Env } from '../types';

export const AUTOMATION_EVENT = 'automation.crawl.v1' as const;
export type AutomationKind = 'lead_generator' | 'list_scraper' | 'data_collector';
export type AutomationInput = { domains: string[]; maxPages: number; respectRobots: true };
export type AutomationQueueJob = { type: typeof AUTOMATION_EVENT; jobId: string };

const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
export const normalizeDomains = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const domains = [...new Set(value.map((item) => typeof item === 'string' ? item.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') : ''))];
  return domains.every((domain) => domainPattern.test(domain) && !domain.endsWith('.local') && domain !== 'localhost') ? domains : null;
};

export const isAutomationQueueJob = (value: unknown): value is AutomationQueueJob =>
  Boolean(value && typeof value === 'object' && (value as any).type === AUTOMATION_EVENT && typeof (value as any).jobId === 'string');

const decodeEntities = (value: string) => value.replace(/&#64;/g, '@').replace(/&#x40;/gi, '@').replace(/&amp;/g, '&');
export const extractAutomationPage = (html: string, sourceUrl: string) => {
  const text = decodeEntities(html.slice(0, 1_000_000));
  const emails = [...new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/gi) ?? [])
    .map((email) => email.toLowerCase()).filter((email) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(email)))].slice(0, 100);
  const phones = [...new Set((text.match(/(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}/g) ?? []).map((phone) => phone.trim()))].slice(0, 50);
  const title = text.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]?.trim() ?? null;
  const description = text.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']{1,500})/i)?.[1]?.trim() ?? null;
  const origin = new URL(sourceUrl).origin;
  const links = [...text.matchAll(/<a\s+[^>]*href=["']([^"'#]+)["']/gi)].map((match) => {
    try { const url = new URL(match[1], sourceUrl); return url.origin === origin && url.protocol === 'https:' ? url.href : null; } catch { return null; }
  }).filter((url): url is string => Boolean(url));
  return { emails, phones, title, description, links: [...new Set(links)] };
};

const robotsAllows = async (origin: string) => {
  try {
    const response = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': 'GoldShoreAdminCrawler/1.0' }, redirect: 'follow' });
    if (!response.ok) return true;
    const body = (await response.text()).slice(0, 100_000);
    const globalRules = body.split(/user-agent\s*:/i).slice(1).filter((section) => /^\s*\*/.test(section));
    return !globalRules.some((section) => /disallow\s*:\s*\/\s*(?:\r?\n|$)/i.test(section));
  } catch { return true; }
};

const fetchPage = async (url: string) => {
  const response = await fetch(url, { headers: { 'user-agent': 'GoldShoreAdminCrawler/1.0 (+https://goldshore.ai)' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) throw new Error('UNSUPPORTED_CONTENT');
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > 1_000_000) throw new Error('CONTENT_TOO_LARGE');
  return (await response.text()).slice(0, 1_000_000);
};

export async function processAutomationJob(env: Pick<Env, 'PLATFORM_DB'>, jobId: string): Promise<void> {
  const row = await env.PLATFORM_DB.prepare('SELECT id,kind,status,input_json FROM automation_jobs WHERE id=?').bind(jobId).first<{ id:string; kind:AutomationKind; status:string; input_json:string }>();
  if (!row || row.status === 'cancelled' || row.status === 'completed') return;
  const input = JSON.parse(row.input_json) as AutomationInput;
  await env.PLATFORM_DB.batch([
    env.PLATFORM_DB.prepare("UPDATE automation_jobs SET status='running',attempts=attempts+1,started_at=COALESCE(started_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP,error_code=NULL WHERE id=?").bind(jobId),
    env.PLATFORM_DB.prepare('DELETE FROM automation_results WHERE job_id=?').bind(jobId),
  ]);
  let pagesScanned = 0; let contactsFound = 0; let errors = 0;
  try {
    for (const domain of input.domains) {
      const origin = `https://${domain}`;
      if (input.respectRobots && !(await robotsAllows(origin))) {
        await env.PLATFORM_DB.prepare("INSERT INTO automation_results(id,job_id,source_url,result_type,data_json) VALUES(?,?,?,'crawl_error',?)")
          .bind(crypto.randomUUID(), jobId, origin, JSON.stringify({ code: 'ROBOTS_DISALLOWED' })).run(); errors++; continue;
      }
      const pending = [`${origin}/`]; const visited = new Set<string>();
      while (pending.length && visited.size < input.maxPages) {
        const url = pending.shift()!; if (visited.has(url)) continue; visited.add(url);
        try {
          const page = extractAutomationPage(await fetchPage(url), url); pagesScanned++;
          const resultType = page.emails.length || page.phones.length ? 'business_contact' : 'page_record';
          contactsFound += page.emails.length + page.phones.length;
          await env.PLATFORM_DB.prepare('INSERT INTO automation_results(id,job_id,source_url,result_type,data_json) VALUES(?,?,?,?,?)')
            .bind(crypto.randomUUID(), jobId, url, resultType, JSON.stringify({ title: page.title, description: page.description, emails: page.emails, phones: page.phones })).run();
          for (const link of page.links) if (pending.length + visited.size < input.maxPages * 3) pending.push(link);
        } catch (error) {
          errors++; await env.PLATFORM_DB.prepare("INSERT INTO automation_results(id,job_id,source_url,result_type,data_json) VALUES(?,?,?,'crawl_error',?)")
            .bind(crypto.randomUUID(), jobId, url, JSON.stringify({ code: error instanceof Error ? error.message : 'FETCH_FAILED' })).run();
        }
      }
      const state = await env.PLATFORM_DB.prepare('SELECT status FROM automation_jobs WHERE id=?').bind(jobId).first<{status:string}>();
      if (state?.status === 'cancelled') return;
    }
    await env.PLATFORM_DB.prepare("UPDATE automation_jobs SET status='completed',summary_json=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='running'")
      .bind(JSON.stringify({ domains: input.domains.length, pagesScanned, contactsFound, errors }), jobId).run();
  } catch (error) {
    await env.PLATFORM_DB.prepare("UPDATE automation_jobs SET status='failed',error_code=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?")
      .bind(error instanceof Error ? error.message.slice(0, 120) : 'PROCESSING_FAILED', jobId).run();
    throw error;
  }
}
