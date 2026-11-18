#!/usr/bin/env node
/* Verify original files before publishing; never fetch external media. */
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pub=path.join(root,'public');
const manifest=JSON.parse(readFileSync(path.join(pub,'offline-video-manifest.json'),'utf8'));
const LIMIT={main:15,short:50},SINGLE={main:5000000,short:1500000};
let bytes=0;const seen=new Set(),counts={main:0,short:0},errors=[];
if(manifest.version!==1||!Array.isArray(manifest.videos))errors.push('Invalid manifest');
for(const v of manifest.videos||[]){
  if(!v||!Object.hasOwn(LIMIT,v.kind)){errors.push('Unknown media kind');continue;}
  counts[v.kind]++;
  const id=String(v.id||'unknown');
  if(!/^[a-zA-Z0-9_-]{3,64}$/.test(id)||seen.has(id))errors.push(id+': invalid or duplicate ID');
  seen.add(id);
  if(!['owned','licensed-offline'].includes(v.offlineRights))errors.push(id+': rights not verified');
  if(!/^video\/(webm|mp4)(;\s*codecs="[a-z0-9., -]+")?$/.test(String(v.mime||'').toLowerCase()))errors.push(id+': media MIME invalid');
  const url=String(v.url||'');
  if(!/^\/owned-media\/[a-zA-Z0-9_./-]+\.(webm|mp4)$/.test(url)||
    url.split('/').includes('..')||url.includes('//')){
    errors.push(id+': invalid first-party media path');continue;
  }
  const file=path.resolve(pub,'.'+url);
  if(!file.startsWith(path.join(pub,'owned-media')+path.sep)||!existsSync(file)){
    errors.push(id+': missing/invalid media file');continue;
  }
  const size=statSync(file).size;bytes+=size;
  if(size!==v.sizeBytes||size>SINGLE[v.kind])errors.push(id+': media file size invalid');
  const sha=createHash('sha256').update(readFileSync(file)).digest('hex');
  if(sha!==v.sha256)errors.push(id+': SHA-256 mismatch');
}
for(const kind of Object.keys(LIMIT))if(counts[kind]>LIMIT[kind])errors.push('Too many '+kind+' videos');
if(bytes>95000000)errors.push('Video bytes exceed 95 MB');
const worker=readFileSync(path.join(pub,'sw.js'),'utf8');
const match=worker.match(/const OFFLINE_ASSETS = (\[.*?\]);/);
let shell=0;
if(match)for(const item of JSON.parse(match[1].replace(/'/g,'"'))){
  if(item==='/')continue;
  const file=path.join(pub,item.replace(/^\//,''));
  if(existsSync(file))shell+=statSync(file).size;
}
if(shell+bytes>100000000)errors.push('Shell and videos exceed 100 MB');
if(/youtube|ytimg|youtu\.be/i.test(JSON.stringify(manifest.videos)))errors.push('YouTube files are prohibited');
console.log(JSON.stringify({main:counts.main,short:counts.short,mediaMB:(bytes/1e6).toFixed(2),
  shellMB:(shell/1e6).toFixed(2),totalMB:((shell+bytes)/1e6).toFixed(2),errors},null,2));
if(errors.length)process.exitCode=1;
