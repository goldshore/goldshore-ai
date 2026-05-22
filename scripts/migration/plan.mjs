#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const inv='reports/migration/inventory.astro-goldshore.tsv';
const lines=fs.readFileSync(inv,'utf8').trim().split('\n').slice(1);
const out=['from\tto\tcategory\trationale'];
const cls={A:[],B:[],C:[],D:[],E:[]};

function mapTo(from){
  const rel=from.replace(/^astro-goldshore\//,'');
  if(rel.startsWith('.github/')) return ['.github/'+rel.slice(8),'E','github consolidation'];
  if(rel.startsWith('apps/admin/')) return ['apps/gs-admin/'+rel.slice('apps/admin/'.length),'A','admin app alignment'];
  if(rel.startsWith('apps/web/')) return ['apps/gs-web/'+rel.slice('apps/web/'.length),'A','web app alignment'];
  if(rel.startsWith('apps/gateway/')) return ['apps/gs-gateway/'+rel.slice('apps/gateway/'.length),'A','gateway alignment'];
  if(rel.startsWith('apps/api-worker/')) return ['apps/gs-api/'+rel.slice('apps/api-worker/'.length),'A','api worker alignment'];
  if(rel.startsWith('packages/')) return [rel,'A','package alignment'];
  if(rel.match(/(^|\/)assets\//i) || rel.match(/\.(svg|png|jpe?g|webp|woff2?)$/i)) return ['public/assets/legacy/astro/'+path.basename(rel),'D','asset centralization'];
  if(rel.startsWith('docs/')||rel.endsWith('.md')) return ['docs/legacy/astro/'+path.basename(rel),'E','docs archival'];
  if(['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','turbo.json','tsconfig.json'].includes(rel)) return ['archive/astro-goldshore/'+rel,'C','legacy root config'];
  return ['archive/astro-goldshore/'+rel,'C','legacy-only archival'];
}
for(const line of lines){
  const from=line.split('\t')[0];
  const [to,c,r]=mapTo(from);
  cls[c].push(from);
  out.push(`${from}\t${to}\t${c}\t${r}`);
}
fs.writeFileSync('reports/migration/path-map.tsv',out.join('\n')+'\n');
fs.writeFileSync('reports/migration/classification.json',JSON.stringify(cls,null,2)+'\n');
console.log('wrote path-map and classification');
