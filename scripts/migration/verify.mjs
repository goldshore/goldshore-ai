#!/usr/bin/env node
import {execSync} from 'node:child_process';
import fs from 'node:fs';
const logs=[];
function run(cmd){
  try{const o=execSync(cmd,{encoding:'utf8'});logs.push(`$ ${cmd}\n${o}`);}catch(e){logs.push(`$ ${cmd}\n${e.stdout||''}${e.stderr||''}`);}
}
run("rg -n 'astro-goldshore/' -g '!archive/**' .");
run("rg -n '/assets/' apps packages src");
run("rg -n 'tokens\\.css' .");
fs.writeFileSync('reports/migration/verification.log',logs.join('\n---\n'));
console.log('verification log written');
