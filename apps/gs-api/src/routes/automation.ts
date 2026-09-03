import { Hono } from 'hono';
import { getActor, logAdminAction, requirePermission } from '../auth';
import type { Env, Variables } from '../types';
import { AUTOMATION_EVENT, type AutomationKind, normalizeDomains } from '../lib/automation-jobs';

const automation = new Hono<{ Bindings: Env; Variables: Variables }>();
const kinds = new Set<AutomationKind>(['lead_generator', 'list_scraper', 'data_collector']);
const statuses = new Set(['queued', 'running', 'completed', 'failed', 'cancelled']);
const audit = (c:any, action:string, metadata:Record<string,unknown>) => logAdminAction(c.env, { action, actor:getActor(c.get('accessClaims'), c.req.raw), status:'success', metadata });

automation.get('/jobs', requirePermission('forms:read'), async (c) => {
  const page=Math.max(1,Number.parseInt(c.req.query('page')??'1',10)||1); const pageSize=Math.min(100,Math.max(10,Number.parseInt(c.req.query('pageSize')??'25',10)||25));
  const kind=c.req.query('kind'); const status=c.req.query('status'); const where:string[]=[]; const values:unknown[]=[];
  if(kind&&kinds.has(kind as AutomationKind)){where.push('kind=?');values.push(kind);} if(status&&statuses.has(status)){where.push('status=?');values.push(status);} const filter=where.length?`WHERE ${where.join(' AND ')}`:'';
  const rows=await c.env.PLATFORM_DB.prepare(`SELECT id,kind,status,input_json,summary_json,error_code,requested_by,attempts,created_at,started_at,completed_at,updated_at FROM automation_jobs ${filter} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...values,pageSize,(page-1)*pageSize).all<any>();
  const count=await c.env.PLATFORM_DB.prepare(`SELECT COUNT(*) total FROM automation_jobs ${filter}`).bind(...values).first<{total:number}>(); const total=Number(count?.total??0);
  return c.json({items:rows.results.map((row)=>({...row,input:JSON.parse(row.input_json),summary:row.summary_json?JSON.parse(row.summary_json):null,input_json:undefined,summary_json:undefined})),pagination:{page,pageSize,total,pages:Math.max(1,Math.ceil(total/pageSize))}});
});

automation.get('/jobs/:id', requirePermission('forms:read'), async (c) => {
  const job=await c.env.PLATFORM_DB.prepare('SELECT id,kind,status,input_json,summary_json,error_code,requested_by,attempts,created_at,started_at,completed_at,updated_at FROM automation_jobs WHERE id=?').bind(c.req.param('id')).first<any>();
  if(!job)return c.json({error:'Automation job not found.'},404);
  const page=Math.max(1,Number.parseInt(c.req.query('page')??'1',10)||1); const pageSize=Math.min(100,Math.max(10,Number.parseInt(c.req.query('pageSize')??'25',10)||25));
  const results=await c.env.PLATFORM_DB.prepare('SELECT id,source_url,result_type,data_json,created_at FROM automation_results WHERE job_id=? ORDER BY created_at ASC LIMIT ? OFFSET ?').bind(job.id,pageSize,(page-1)*pageSize).all<any>();
  const count=await c.env.PLATFORM_DB.prepare('SELECT COUNT(*) total FROM automation_results WHERE job_id=?').bind(job.id).first<{total:number}>(); const total=Number(count?.total??0);
  return c.json({job:{...job,input:JSON.parse(job.input_json),summary:job.summary_json?JSON.parse(job.summary_json):null,input_json:undefined,summary_json:undefined},results:results.results.map((row)=>({...row,data:JSON.parse(row.data_json),data_json:undefined})),pagination:{page,pageSize,total,pages:Math.max(1,Math.ceil(total/pageSize))}});
});

automation.post('/jobs', requirePermission('forms:write'), async (c) => {
  if(!c.env.JOBS_QUEUE)return c.json({error:'Automation queue is not configured.'},503);
  const body=await c.req.json<{kind?:AutomationKind;domains?:unknown;maxPages?:number;respectRobots?:boolean}>().catch(()=>null); const domains=normalizeDomains(body?.domains);
  if(!body?.kind||!kinds.has(body.kind)||!domains)return c.json({error:'A valid workflow kind and 1-50 public domains are required.'},400);
  if(body.respectRobots!==true)return c.json({error:'Robots.txt compliance is required.'},400);
  const maxPages=Math.min(10,Math.max(1,Number.isInteger(body.maxPages)?body.maxPages!:3)); const id=crypto.randomUUID(); const actor=getActor(c.get('accessClaims'),c.req.raw);
  await c.env.PLATFORM_DB.prepare("INSERT INTO automation_jobs(id,kind,status,input_json,requested_by) VALUES(?,?,'queued',?,?)").bind(id,body.kind,JSON.stringify({domains,maxPages,respectRobots:true}),actor).run();
  try{await c.env.JOBS_QUEUE.send({type:AUTOMATION_EVENT,jobId:id});}catch{await c.env.PLATFORM_DB.prepare("UPDATE automation_jobs SET status='failed',error_code='QUEUE_UNAVAILABLE',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return c.json({error:'Automation queue rejected the job.',jobId:id},503);}
  await audit(c,'automation.job.create',{jobId:id,kind:body.kind,domainCount:domains.length,maxPages}); return c.json({id,status:'queued'},202);
});

automation.post('/jobs/:id/cancel', requirePermission('forms:write'), async (c) => {
  const result=await c.env.PLATFORM_DB.prepare("UPDATE automation_jobs SET status='cancelled',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('queued','running')").bind(c.req.param('id')).run();
  if(!result.meta.changes)return c.json({error:'Only queued or running jobs can be cancelled.'},409); await audit(c,'automation.job.cancel',{jobId:c.req.param('id')}); return c.json({id:c.req.param('id'),status:'cancelled'});
});

automation.post('/jobs/:id/retry', requirePermission('forms:write'), async (c) => {
  if(!c.env.JOBS_QUEUE)return c.json({error:'Automation queue is not configured.'},503); const id=c.req.param('id');
  const result=await c.env.PLATFORM_DB.prepare("UPDATE automation_jobs SET status='queued',error_code=NULL,completed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('failed','cancelled')").bind(id).run();
  if(!result.meta.changes)return c.json({error:'Only failed or cancelled jobs can be retried.'},409);
  try{await c.env.JOBS_QUEUE.send({type:AUTOMATION_EVENT,jobId:id});}catch{await c.env.PLATFORM_DB.prepare("UPDATE automation_jobs SET status='failed',error_code='QUEUE_UNAVAILABLE',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return c.json({error:'Automation queue rejected the retry.',jobId:id},503);}
  await audit(c,'automation.job.retry',{jobId:id}); return c.json({id,status:'queued'},202);
});

export default automation;
