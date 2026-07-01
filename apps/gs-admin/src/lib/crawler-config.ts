export interface CrawlJob {
  id: string;
  domain: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  leadsFound: number;
  emailsFound: string[];
  phonesFound: string[];
  error?: string;
}

export interface DiscoveredLead {
  id: string;
  domain: string;
  email: string;
  phone?: string;
  name?: string;
  title?: string;
  company?: string;
  industry?: string;
  discoveredAt: string;
  source: 'web-crawler';
  confidence: number; // 0-1 score for data quality
}

export const validateDomain = (domain: string): boolean => {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
};

export const extractEmails = (content: string): string[] => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = content.match(emailRegex) || [];
  // Filter out common non-business emails
  return emails.filter(
    (email) =>
      !email.includes('noreply') &&
      !email.includes('test') &&
      !email.match(/@(gmail|yahoo|outlook|hotmail)\.com$/)
  );
};

export const extractPhones = (content: string): string[] => {
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?(?:\d{3})\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = content.match(phoneRegex) || [];
  return [...new Set(phones)]; // Deduplicate
};

export const createCrawlJob = (domain: string): CrawlJob => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    domain,
    status: 'pending',
    startedAt: new Date().toISOString(),
    leadsFound: 0,
    emailsFound: [],
    phonesFound: [],
  };
};

export const processCrawlResult = (domain: string, htmlContent: string, emails: string[], phones: string[]): DiscoveredLead[] => {
  const leads: DiscoveredLead[] = [];

  // Create leads from discovered emails
  emails.forEach((email) => {
    leads.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      domain,
      email,
      discoveredAt: new Date().toISOString(),
      source: 'web-crawler',
      confidence: 0.7, // Default confidence for web-discovered emails
    });
  });

  return leads;
};

export const formatCrawlStats = (jobs: CrawlJob[]) => {
  const completed = jobs.filter((j) => j.status === 'completed').length;
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const running = jobs.filter((j) => j.status === 'running').length;
  const totalLeads = jobs.reduce((sum, j) => sum + j.leadsFound, 0);
  const totalEmails = jobs.reduce((sum, j) => sum + j.emailsFound.length, 0);

  return {
    totalJobs: jobs.length,
    completed,
    failed,
    running,
    totalLeads,
    totalEmails,
    successRate: jobs.length > 0 ? (completed / jobs.length) * 100 : 0,
  };
};
