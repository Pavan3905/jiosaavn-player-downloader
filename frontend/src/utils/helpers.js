export const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
  : ''

export function apiUrl(endpoint) {
  if (!endpoint) return ''
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint
  if (!endpoint.startsWith('/')) endpoint = '/' + endpoint
  return `${API_BASE}${endpoint}`
}

let domParser = null

export function decodeHtmlEntities(str) {
  if (!str) return ''
  if (!str.includes('&')) return str
  try {
    if (!domParser && typeof DOMParser !== 'undefined') {
      domParser = new DOMParser()
    }
    if (domParser) {
      const doc = domParser.parseFromString(str, 'text/html')
      return doc.body.textContent || ''
    }
  } catch {
    // fallback if parser fails
  }
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'")
}

export function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  })
}

export function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + (s < 10 ? '0' : '') + s
}

export function cleanLyrics(rawText) {
  if (!rawText) return ''
  return rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

export function createLrcFile(lyrics, track = {}) {
  const clean = cleanLyrics(lyrics)
  if (!clean) return ''

  const metadata = [
    ['ti', track.name || 'Untitled'],
    ['ar', track.artist || 'Various Artists'],
    ['al', (track.album && track.album.name) || 'Single']
  ]
  const missingHeaders = metadata
    .filter((entry) => {
      const headerPattern = new RegExp('^\\[' + entry[0] + ':', 'im')
      return !headerPattern.test(clean)
    })
    .map((entry) => {
      const value = String(entry[1]).replace(/[\r\n\]]/g, ' ').trim()
      return '[' + entry[0] + ':' + value + ']'
    })
  const prefix = missingHeaders.length ? missingHeaders.join('\n') + '\n' : ''
  return prefix + clean.replace(/\n*$/, '') + '\n'
}

export function normalizeTrack(raw) {
  if (!raw || !raw.id) return null
  const name = decodeHtmlEntities(raw.name || raw.title || 'Untitled')
  let artistName = ''

  if (typeof raw.primaryArtists === 'string' && raw.primaryArtists) {
    artistName = raw.primaryArtists
  } else if (raw.artists && Array.isArray(raw.artists.primary) && raw.artists.primary.length) {
    artistName = raw.artists.primary.map((a) => a.name).join(', ')
  } else if (raw.singers) {
    artistName = raw.singers
  } else {
    artistName = 'Various Artists'
  }
  artistName = decodeHtmlEntities(artistName)

  let albumName = 'Single'
  let albumId = null
  if (raw.album && typeof raw.album === 'object') {
    albumName = raw.album.name || 'Single'
    albumId = raw.album.id || null
  } else if (typeof raw.album === 'string' && raw.album) {
    albumName = raw.album
  }
  albumName = decodeHtmlEntities(albumName)

  let img = ''
  let coverImg = ''
  if (Array.isArray(raw.image) && raw.image.length) {
    img = (raw.image[1] && raw.image[1].url) || raw.image[raw.image.length - 1].url || raw.image[0].url || ''
    coverImg = raw.image[raw.image.length - 1].url || img
  } else if (typeof raw.image === 'string') {
    img = raw.image
    coverImg = raw.image
  }

  const artists = raw.artists || {}
  const artistNames = (list) => {
    return Array.isArray(list) ? list.map((a) => a && a.name).filter(Boolean).join(', ') : ''
  }
  const featuredArtists = artistNames(artists.featured)
  const allArtists = artistNames(artists.all)
  const playCount = raw.playCount === null || raw.playCount === undefined ? null : Number(raw.playCount)

  return {
    id: raw.id,
    name,
    type: raw.type || 'song',
    artist: artistName,
    album: {
      id: albumId || (raw.album && raw.album.id) || null,
      name: albumName,
      url: (raw.album && raw.album.url) || ''
    },
    duration: typeof raw.duration === 'number' ? raw.duration : parseInt(raw.duration, 10) || 0,
    year: raw.year || '',
    releaseDate: raw.releaseDate || raw.year || '',
    label: raw.label || '',
    copyright: raw.copyright || '',
    language: raw.language || raw.lang || '',
    playCount: Number.isFinite(playCount) ? playCount : null,
    explicitContent: raw.explicitContent === true || raw.explicitContent === '1',
    url: raw.url || '',
    featuredArtists,
    allArtists,
    image: img,
    coverImage: coverImg,
    hasLyrics: Boolean(raw.hasLyrics || raw.lyricsId),
    lyricsId: raw.lyricsId || null,
    downloadUrl: Array.isArray(raw.downloadUrl) ? raw.downloadUrl : [],
    detailsLoaded: Boolean(Array.isArray(raw.downloadUrl) && raw.downloadUrl.length)
  }
}

export function getAudioUrlFromTrack(track, preferredQuality = '320kbps') {
  if (!track) return ''
  const urls = track.downloadUrl || []
  if (!urls.length) return ''
  const match = urls.find((u) => u.quality === preferredQuality)
  if (match) return match.url

  const targetBitrate = parseInt(preferredQuality, 10) || 320
  const ranked = urls
    .map((item) => ({
      url: item.url,
      bitrate: parseInt(item.quality, 10) || 0
    }))
    .sort((a, b) => b.bitrate - a.bitrate)

  const fallback = ranked.find((item) => item.bitrate <= targetBitrate) || ranked[0]
  return fallback ? fallback.url : ''
}
