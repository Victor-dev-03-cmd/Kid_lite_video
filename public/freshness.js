/* KidLite Smart Feed Freshness — browser-only metadata ordering.
   Does not modify API URLs or re-fetch YouTube on every browser refresh. */
(function () {
  'use strict';
  const KEY='kidlite.videos.seen.v1',LIMIT=500;
  const TAMIL=new Set(['chuchutamil','pattampoochi','infobellstamil',
    'shemarootamil','chuttykannamma','kidstvtamil']);
  const FEATURED=new Set(['bumblezoop','bachpankiduniya','bibotoys']);

  function readSeen() {
    try {
      const history=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Array.isArray(history)
        ? history.filter(id=>typeof id==='string'&&/^[\w-]{11}$/.test(id)).slice(-LIMIT):[];
    } catch (_) {return [];}
  }
  function markWatched(videoId) {
    if(typeof videoId!=='string'||!/^[\w-]{11}$/.test(videoId))return;
    const values=readSeen().filter(id=>id!==videoId);
    values.push(videoId);
    try {localStorage.setItem(KEY,JSON.stringify(values.slice(-LIMIT)));}catch(_){}
  }
  function createSeed() {
    try {
      if(window.crypto?.getRandomValues){
        const bytes=new Uint32Array(1);
        window.crypto.getRandomValues(bytes);
        return bytes[0]||1;
      }
    }catch(_){}
    return (Date.now() ^ (Math.random()*0xffffffff))>>>0 || 1;
  }
  function randomSource(seed) {
    let x=(seed>>>0)||0x9e3779b9;
    return ()=>{
      x^=x<<13;x^=x>>>17;x^=x<<5;
      return (x>>>0)/4294967296;
    };
  }
  function hash(text) {
    let value=2166136261;
    for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);
    return value>>>0;
  }
  function shuffle(items,seed=1) {
    const copy=[...items];
    const rng=randomSource(Number(seed)||1);
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(rng()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }
  function group(key,channel) {
    if(channel!=='all')return 'only';
    if(TAMIL.has(key))return 'tamil';
    if(FEATURED.has(key))return 'featured';
    return 'other';
  }
  function diversify(items,seed) {
    const channels=new Map();
    for(const video of items){
      const key=video.channelKey||'other';
      if(!channels.has(key))channels.set(key,[]);
      channels.get(key).push(video);
    }
    const keys=shuffle([...channels.keys()],seed);
    for(const key of keys)channels.set(key,shuffle(channels.get(key),seed ^ hash(key)));
    const result=[];
    let index=0;
    while(true){
      let added=false;
      for(const key of keys){
        const next=channels.get(key)[index];
        if(next){result.push(next);added=true;}
      }
      if(!added)break;
      index++;
    }
    return result;
  }
  function weave(groups,weights) {
    const offsets=groups.map(()=>0),result=[];
    while(true){
      let added=false;
      for(let i=0;i<groups.length;i++){
        for(let take=0;take<weights[i]&&offsets[i]<groups[i].length;take++){
          result.push(groups[i][offsets[i]++]);added=true;
        }
      }
      if(!added)break;
    }
    return result;
  }
  function order(videos,{seed=createSeed(),channel='all'}={}) {
    if(!Array.isArray(videos)||!videos.length)return [];
    const seen=new Set(readSeen());
    const ranked=Array.from({length:2},()=>({tamil:[],featured:[],other:[],only:[]}));
    const known=new Set();
    for(const video of videos){
      if(!video||typeof video.id!=='string'||known.has(video.id))continue;
      known.add(video.id);
      const bucket=seen.has(video.id)?1:0;
      ranked[bucket][group(video.channelKey,channel)].push(video);
    }
    const spread=(bucket,salt)=>{
      if(channel!=='all')return diversify(bucket.only,seed ^ salt);
      return weave([
        diversify(bucket.tamil,seed ^ salt ^ 11),
        diversify(bucket.featured,seed ^ salt ^ 37),
        diversify(bucket.other,seed ^ salt ^ 73)
      ],[3,3,1]);
    };
    // Unseen first, watched below. Group preference is preserved inside each partition.
    return [...spread(ranked[0],0x13a4),...spread(ranked[1],0x9b72)];
  }
  window.KidLiteFreshness={createSeed,shuffle,order,readSeen,markWatched};
})();
