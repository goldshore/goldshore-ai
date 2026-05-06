#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [root='.', out='reports/migration/inventory.tsv'] = process.argv.slice(2);
const ex = new Set(['node_modules','.git','dist','.astro']);
const rows=['path\tbytes\tmtime_iso\tsha256\tmime'];

function mimeFor(p){
  const e=path.extname(p).toLowerCase();
  return ({'.js':'text/javascript','.mjs':'text/javascript','.ts':'text/typescript','.tsx':'text/tsx','.json':'application/json','.yaml':'text/yaml','.yml':'text/yaml','.toml':'application/toml','.md':'text/markdown','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2'})[e]||'application/octet-stream';
}
function walk(d){
  for(const ent of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const fp=path.join(d,ent.name);
    const rel=path.relative(root,fp).replace(/\\/g,'/');
    if(ent.isDirectory()){
      if(ex.has(ent.name)) continue;
      walk(fp);
    } else if(ent.isFile()) {
      const buf=fs.readFileSync(fp);
      const st=fs.statSync(fp);
      rows.push(`${rel}\t${st.size}\t${st.mtime.toISOString()}\t${crypto.createHash('sha256').update(buf).digest('hex')}\t${mimeFor(fp)}`);
    }
  }
}
walk(root);
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,rows.join('\n')+'\n');
console.log(`wrote ${out} (${rows.length-1} files)`);
