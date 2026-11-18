// Parent-selected, fixed channel allowlist. Only these four reviewed links are exposed.
// This is NOT an open YouTube search proxy; arbitrary video/channel IDs are never accepted.
const CHANNELS = Object.freeze({
  cocomelon: { id: 'UCbCmjCuTUZos6Inko4u57UQ', title: 'CoComelon - Nursery Rhymes' },
  kidschannel: { id: 'UC3KknIJZXRygH2pZ6MDtGbg', title: 'Kids Channel - Cartoon Videos for Kids' },
});
const CURATED = Object.freeze([
  { id:'2iEpWefmdQI', channel:'cocomelon', title:'Best of Wheels on the Bus! CoComelon Nursery Rhymes', ageBands:['2-5'], tags:['songs','rhymes','bus','music','cocomelon'], kind:'video' },
  { id:'co8d0AM3pvs', channel:'cocomelon', title:'Learn ABCs and the Alphabet | CoComelon', ageBands:['2-5'], tags:['abc','letters','alphabet','rhymes','cocomelon'], kind:'video' },
  { id:'7QcV6KOruPs', channel:'kidschannel', title:'Learn Colors with Bob | Kids Channel', ageBands:['2-5'], tags:['colors','bob','learning','kids','channel'], kind:'video' },
  { id:'6lhkLWxbESI', channel:'kidschannel', title:'Learn Colors with Surprise Eggs | Kids Channel', ageBands:['2-5'], tags:['colors','eggs','learning','kids','channel'], kind:'video' }
]);
export function GET(request: Request) {
  const url = new URL(request.url);
  const age = url.searchParams.get('age') || 'all';
  const channel = url.searchParams.get('channel') || 'all';
  const kind = url.searchParams.get('kind') || 'video';
  const q = (url.searchParams.get('q') || '').trim().slice(0,60).toLowerCase();
  if (!['all','2-5','6-9','10-12'].includes(age) || !['all',...Object.keys(CHANNELS)].includes(channel) || !['video','short'].includes(kind)) {
    return Response.json({ error: 'Invalid filter' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const videos = CURATED.filter(v => v.kind === kind && (channel === 'all' || v.channel === channel) &&
    (age === 'all' || v.ageBands.includes(age)) &&
    (!q || (v.title + ' ' + v.tags.join(' ')).toLowerCase().includes(q)))
    .map(v => ({ id: v.id, title: v.title, channelKey: v.channel, channel: CHANNELS[v.channel as keyof typeof CHANNELS].title,
      channelId: CHANNELS[v.channel as keyof typeof CHANNELS].id, ageBands: v.ageBands, source: 'YouTube' }));
  return Response.json({ videos, channels: CHANNELS, curated: true, ageLabel: 'Suggested suitability only',
    note: 'Only user-selected channels and manually chosen video IDs; no unrestricted recommendations.' },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600' } });
}
