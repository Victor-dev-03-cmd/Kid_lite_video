// KidLite YouTube Data API reader: only the parent's explicitly selected channels.
// No arbitrary video ID, YouTube search term, or channel ID can be requested from clients.
// The YouTube API key stays server-side. Results are *not* a child-safety certification.
type Channel = { id?: string; handle?: string; title: string; emoji: string };
type Video = { id: string; title: string; channelKey: string; channel: string; channelId: string; ageBands: string[]; source: string; durationSeconds?: number; thumbnail?: string; kind?: string };
const CHANNELS: Record<string, Channel> = {
  cocomelon:  { id: 'UCbCmjCuTUZos6Inko4u57UQ', title: 'CoComelon - Nursery Rhymes', emoji:'🍉' },
  kidschannel: { id:'UC3KknIJZXRygH2pZ6MDtGbg', title:'Kids Channel', emoji:'🚂' },
  chuchutamil: { id:'UClPHwLcsE9zQcIqNRc7VLHw', title:'ChuChu TV Tamil', emoji:'🎵' },
  pattampoochi: { id:'UC1TTQC50cT0t5Li13udBCBA', title:'Pattampoochi', emoji:'🦋' },
  infobellstamil: { id:'UCHcn4Ux-sO9nzNu7rDsoQLg', title:'Infobells Tamil', emoji:'🌸' },
  shemarootamil: { handle:'@shemarookidstamil', title:'Shemaroo Kids Tamil', emoji:'📚' },
  chuttykannamma: { id:'UC7ekJbGft4swD_3fb7MiRPw', title:'Chutty Kannamma', emoji:'🌈' },
  kidstvtamil: { handle:'@kidstvtamil', title:'Kids TV Tamil', emoji:'🐥' }
};
const ALLOWED_AGES = ['all','2-5','6-9','10-12'];
const STARTER: Video[] = [
  {id:'2iEpWefmdQI',title:'Best of Wheels on the Bus! CoComelon Nursery Rhymes',channelKey:'cocomelon',channel:'CoComelon - Nursery Rhymes',channelId:'UCbCmjCuTUZos6Inko4u57UQ',ageBands:['2-5'],source:'YouTube',kind:'video'},
  {id:'co8d0AM3pvs',title:'Learn ABCs and the Alphabet | CoComelon',channelKey:'cocomelon',channel:'CoComelon - Nursery Rhymes',channelId:'UCbCmjCuTUZos6Inko4u57UQ',ageBands:['2-5'],source:'YouTube',kind:'video'},
  {id:'7QcV6KOruPs',title:'Learn Colors with Bob | Kids Channel',channelKey:'kidschannel',channel:'Kids Channel',channelId:'UC3KknIJZXRygH2pZ6MDtGbg',ageBands:['2-5'],source:'YouTube',kind:'video'},
  {id:'6lhkLWxbESI',title:'Learn Colors with Surprise Eggs | Kids Channel',channelKey:'kidschannel',channel:'Kids Channel',channelId:'UC3KknIJZXRygH2pZ6MDtGbg',ageBands:['2-5'],source:'YouTube',kind:'video'}
];
const cache = new Map<string, { until:number; videos:Video[] }>();
function durationSeconds(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  return Number(m[1] || 0)*3600 + Number(m[2] || 0)*60 + Number(m[3] || 0);
}
async function youtube(endpoint:string, params:Record<string,string>, key:string): Promise<any> {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + endpoint);
  for(const [name,value] of Object.entries(params)) url.searchParams.set(name,value);
  url.searchParams.set('key', key);
  // Never log the URL: it contains the secret YouTube key.
  const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error('YouTube provider unavailable');
  return await response.json();
}
async function channelVideos(key:string, channelKey:string):Promise<Video[]> {
  const cached=cache.get(channelKey);
  if (cached && cached.until>Date.now()) return cached.videos;
  const channel=CHANNELS[channelKey];
  if(!channel) return [];
  const lookup = channel.id ? {id:channel.id} : {forHandle:channel.handle!};
  const results = await youtube('channels',{part:'snippet,contentDetails',...lookup},key);
  const match = results.items?.[0];
  const id: string | undefined=match?.id;
  const uploads: string | undefined=match?.contentDetails?.relatedPlaylists?.uploads;
  if(!id || !/^UC[\w-]{22}$/.test(id) || !uploads) return [];
  // Look up videos in this channel's uploads playlist; low-quota compared with search.list.
  const playlist=await youtube('playlistItems',{part:'snippet',playlistId:uploads,maxResults:'50'},key);
  const ids=(playlist.items || []).map((x:any)=>x?.snippet?.resourceId?.videoId)
    .filter((id:any)=>typeof id==='string' && /^[\w-]{11}$/.test(id)).slice(0,50);
  if(!ids.length) {cache.set(channelKey,{until:Date.now()+12*60*1000,videos:[]});return [];}
  const details=await youtube('videos',{part:'snippet,contentDetails,status',id:ids.join(','),maxResults:'50'},key);
  const videos:Video[]=[];
  for(const v of details.items || []) {
    const s=v.snippet, status=v.status;
    if(!s || s.channelId!==id || status?.privacyStatus!=='public' || status?.embeddable===false || status?.madeForKids===false) continue;
    const seconds=durationSeconds(v.contentDetails?.duration||'');
    if(seconds<5 || seconds>7200 || s.liveBroadcastContent==='live') continue;
    const tagged=/#(?:shorts|ytshorts)\b/i.test((s.title||'')+' '+(s.description||''));
    const kind=(seconds<=180 && tagged)?'short':'video';
    // Only reasonably long-form items in Videos. Untagged <=3min clips stay out of Shorts.
    if(kind==='video' && seconds<=180) continue;
    const thumbnail=s.thumbnails?.medium?.url || s.thumbnails?.high?.url || '';
    const title=String(s.title||'').slice(0,180);
    if(!title || !/^[\w-]{11}$/.test(v.id)) continue;
    videos.push({id:v.id,title,channelKey,channel:channel.title,channelId:id,ageBands:['2-5'],source:'YouTube',durationSeconds:seconds,
      thumbnail:typeof thumbnail==='string' && thumbnail.startsWith('https://i.ytimg.com/')?thumbnail:undefined,kind});
  }
  cache.set(channelKey,{until:Date.now()+30*60*1000,videos});
  return videos;
}
export async function GET(request:Request) {
  const url=new URL(request.url);
  const age=url.searchParams.get('age')||'all';
  const channel=url.searchParams.get('channel')||'all';
  const kind=url.searchParams.get('kind')||'video';
  const q=(url.searchParams.get('q')||'').trim().slice(0,60).toLocaleLowerCase();
  if(!ALLOWED_AGES.includes(age)||!['all',...Object.keys(CHANNELS)].includes(channel)||!['video','short'].includes(kind)) {
    return Response.json({error:'Invalid filter'}, {status:400,headers:{'Cache-Control':'no-store'}});
  }
  const apiKey=process.env.YOUTUBE_API_KEY?.trim();
  const targets=channel==='all'?Object.keys(CHANNELS):[channel];
  let videos:Video[]=[];
  let mode='youtube-live';
  let notice='';
  if(apiKey && !apiKey.includes('REPLACE_ME')) {
    const lists=await Promise.allSettled(targets.map(k=>channelVideos(apiKey,k)));
    videos=lists.flatMap(item=>item.status==='fulfilled'?item.value:[]);
    if(lists.some(item=>item.status==='rejected')) notice='Some channels could not be refreshed. Check YouTube API quota and key restrictions.';
    if(lists.every(item=>item.status==='rejected')) {
      mode='unavailable';notice='Could not fetch videos from YouTube. Check that the YouTube Data API v3 is enabled and the API key is valid.';
    }
  }else{
    mode='api-key-required';
    notice='Live YouTube Shorts and Tamil-channel videos require a working YOUTUBE_API_KEY in Vercel.';
  }
  if(mode!=='youtube-live' && kind==='video'){
    // Existing hand-picked cards remain visible when the external API is not configured.
    videos=STARTER.filter(x=>channel==='all'||x.channelKey===channel);
  }
  videos=videos.filter(v=>v.kind===kind && (age==='all'||v.ageBands.includes(age)) &&
    (!q || v.title.toLocaleLowerCase().includes(q)||v.channel.toLocaleLowerCase().includes(q)));
  const seen=new Set<string>();
  videos=videos.filter(v=>!seen.has(v.id) && Boolean(seen.add(v.id)));
  videos=videos.slice(0,45);
  const exposed=Object.fromEntries(Object.entries(CHANNELS).map(([k,v])=>[k,{title:v.title,emoji:v.emoji,handle:v.handle||null}]));
  return Response.json({videos,channels:exposed,mode,notice,ageLabel:'Suggested suitability only (not verified age-rated content)',
    shortClassification:'Videos tagged #shorts and at most 180 seconds. The Data API cannot verify aspect ratio or official Shorts classification.',
    source:'YouTube Data API v3',curatedChannels:true},{
    headers:{'Cache-Control':mode==='youtube-live'?'public, s-maxage=900, stale-while-revalidate=600':'no-store'}
  });
}
