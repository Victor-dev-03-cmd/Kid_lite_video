import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const original=readFileSync(path.join(root,'public/offline-pack.js'),'utf8');
const instrumented=original.replace(/\}\)\(\);\s*$/,
  'window.__test={validAsset,chooseEvictions,setPlaying:id=>{playingId=id}};\n})();');
if(instrumented===original)throw Error('Offline pack test exports could not be loaded');
function createMock(videos=[]){
  const win={};
  const ctx={
    window:win,document:{createElement:()=>({canPlayType:()=> 'probably'})},
    navigator:{onLine:true,storage:{estimate:async()=>({usage:3000000,quota:500000000})}},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    fetch:async()=>({ok:true,json:async()=>({version:1,videos})}),
    location:{origin:'https://kid-lites.vercel.app'},
    Blob,URL,crypto:globalThis.crypto,CustomEvent:class{}
  };
  vm.runInNewContext(instrumented,ctx,{filename:'offline-pack.js'});
  return {pack:win.KidLiteOfflinePack,internal:win.__test};
}
function clip(extra={}){
  return {id:'kid_01',kind:'main',title:'Original Story',
    url:'/owned-media/story.mp4',mime:'video/mp4',
    sizeBytes:3300000,sha256:'a'.repeat(64),
    offlineRights:'owned',...extra};
}
test('rights and same-origin paths are required before downloading',async()=>{
  const {pack,internal}=createMock([
    clip(),clip({id:'youtube',url:'https://youtube.com/watch?v=123'}),
    clip({id:'stolen',offlineRights:'unknown'}),
    clip({id:'over',sizeBytes:6000000}),
    clip({id:'wrongcodec',mime:'video/avi'})
  ]);
  const files=await pack.manifest();
  assert.equal(files.length,1);
  assert.equal(files[0].id,'kid_01');
  assert.equal(internal.validAsset(clip({url:'/owned-media/../other.mp4'})),null);
  assert.equal(internal.validAsset(clip({sha256:'bad'})),null);
});
test('watched files are evicted first to keep under 100 MB',()=>{
  const {internal}=createMock();
  const entries=[
    {id:'watched',kind:'main',bytes:2000000,downloadedAt:1,lastPlayedAt:10},
    {id:'unwatched',kind:'main',bytes:2000000,downloadedAt:2,lastPlayedAt:0}
  ];
  const removed=internal.chooseEvictions(entries,clip(),3300000,{usage:99000000,quota:400000000});
  assert.equal(removed[0]?.id,'watched');
  assert.throws(()=>internal.chooseEvictions([],clip(),3300000,
    {usage:99500000,quota:100000000}),/100 MB cap/);
});
test('active video cannot be evicted and main video count is bounded',()=>{
  const {internal}=createMock();
  const list=Array.from({length:15},(_,n)=>({
    id:'video_'+n,kind:'main',bytes:3000000,
    downloadedAt:n+1,lastPlayedAt:n===0?7:0
  }));
  internal.setPlaying('video_0');
  const removed=internal.chooseEvictions(list,clip(),3300000,
    {usage:48000000,quota:400000000});
  assert.equal(removed.length,1);
  assert.notEqual(removed[0].id,'video_0');
});
test('YouTube content never enters the offline pack service worker cache',()=>{
  const sw=readFileSync(path.join(root,'public/sw.js'),'utf8');
  assert.match(sw,/url\.pathname\.startsWith\('\/owned-media\/'\)/);
  assert.match(sw,/offline-pack\.js/);
  assert.match(sw,/offline-video-manifest\.json/);
  const json=JSON.parse(readFileSync(path.join(root,'public/offline-video-manifest.json'),'utf8'));
  assert.deepEqual(json.videos,[]);
});
