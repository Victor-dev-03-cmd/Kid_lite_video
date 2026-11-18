/** Only call YouTube from trusted server routes with channel IDs validated against each family's allowlist. */
export function youtubeSearchUrl(channelId: string, maxResults = 12): URL {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YouTube API key is not configured')
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) throw new Error('Invalid YouTube channel ID')
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('channelId', channelId)
  url.searchParams.set('type', 'video')
  url.searchParams.set('safeSearch', 'strict')
  url.searchParams.set('videoEmbeddable', 'true')
  url.searchParams.set('order', 'date')
  url.searchParams.set('maxResults', String(Math.min(25, Math.max(1, maxResults))))
  url.searchParams.set('key', apiKey)
  return url
}
