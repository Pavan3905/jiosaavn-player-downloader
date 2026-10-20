import { cleanLyrics, createLrcFile, getAudioUrlFromTrack, normalizeTrack, apiUrl } from './helpers.js'

function readAtoms(bytes, start, end) {
  const atoms = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = start

  while (offset + 8 <= end) {
    let size = view.getUint32(offset)
    let header = 8
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])

    if (size === 1) {
      if (offset + 16 > end) throw new Error('Invalid MP4 extended atom')
      size = Number(view.getBigUint64(offset + 8))
      header = 16
    } else if (size === 0) {
      size = end - offset
    }

    if (size < header || offset + size > end) throw new Error('Corrupt MP4 box')
    atoms.push({ start: offset, end: offset + size, size, header, type })
    offset += size
  }
  return atoms
}

function joinBytes(parts) {
  const total = parts.reduce((acc, p) => acc + p.length, 0)
  const res = new Uint8Array(total)
  let offset = 0
  parts.forEach((p) => {
    res.set(p, offset)
    offset += p.length
  })
  return res
}

function makeBox(type, payload) {
  const res = new Uint8Array(payload.length + 8)
  const view = new DataView(res.buffer)
  view.setUint32(0, res.length)
  for (let i = 0; i < 4; i++) res[4 + i] = type.charCodeAt(i)
  res.set(payload, 8)
  return res
}

function itemBox(type, value, dataType = 1) {
  const content = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const header = new Uint8Array(8)
  new DataView(header.buffer).setUint32(0, dataType)
  return makeBox(type, makeBox('data', joinBytes([header, content])))
}

function freeformItemBox(name, value) {
  if (value === null || value === undefined || value === '') return null
  const encoder = new TextEncoder()
  function textAtom(type, text) {
    return makeBox(type, joinBytes([new Uint8Array(4), encoder.encode(text)]))
  }
  const content = encoder.encode(String(value))
  const dataHeader = new Uint8Array(8)
  new DataView(dataHeader.buffer).setUint32(0, 1)
  return makeBox('----', joinBytes([
    textAtom('mean', 'com.apple.iTunes'),
    textAtom('name', name),
    makeBox('data', joinBytes([dataHeader, content]))
  ]))
}

function shiftChunkOffsets(moov, delta, oldMoovEnd) {
  if (!delta) return
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength)

  function visit(start, end, type) {
    if (type === 'stco' || type === 'co64') {
      const count = view.getUint32(start + 12)
      const width = type === 'co64' ? 8 : 4
      for (let i = 0; i < count; i++) {
        const at = start + 16 + i * width
        const offset = type === 'co64' ? Number(view.getBigUint64(at)) : view.getUint32(at)
        if (offset >= oldMoovEnd) {
          const adjusted = offset + delta
          if (type === 'stco') view.setUint32(at, adjusted)
          else view.setBigUint64(at, BigInt(adjusted))
        }
      }
      return
    }
    const containers = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'meta']
    if (!containers.includes(type)) return
    const childStart = start + 8 + (type === 'meta' ? 4 : 0)
    readAtoms(moov, childStart, end).forEach((child) => { visit(child.start, child.end, child.type) })
  }

  visit(0, moov.length, 'moov')
}

export function tagMp4(audioBytes, metadata) {
  const atoms = readAtoms(audioBytes, 0, audioBytes.length)
  const moov = atoms.find((a) => a.type === 'moov')
  if (!moov) throw new Error('Invalid audio container')

  const items = [
    itemBox('©nam', metadata.title),
    itemBox('©ART', metadata.artist),
    itemBox('aART', metadata.albumArtist || metadata.artist),
    itemBox('©alb', metadata.album)
  ]
  const releaseDate = metadata.releaseDate || metadata.year
  if (releaseDate) items.push(itemBox('©day', String(releaseDate)))
  if (metadata.label) items.push(itemBox('©pub', metadata.label))
  if (metadata.copyright) items.push(itemBox('©cmt', metadata.copyright))
  if (metadata.lyrics) items.push(itemBox('©lyr', metadata.lyrics))
  if (metadata.cover) items.push(itemBox('covr', metadata.cover, metadata.coverType))

  const customMetadata = [
    ['LANGUAGE', metadata.language],
    ['RELEASE_DATE', metadata.releaseDate],
    ['LABEL', metadata.label],
    ['COPYRIGHT', metadata.copyright],
    ['PLAY_COUNT', metadata.playCount],
    ['EXPLICIT_CONTENT', metadata.explicitContent ? 'Explicit' : 'Clean'],
    ['TRACK_ID', metadata.trackId],
    ['TRACK_URL', metadata.trackUrl],
    ['ALBUM_ID', metadata.albumId],
    ['ALBUM_URL', metadata.albumUrl],
    ['DURATION_SECONDS', metadata.duration],
    ['TRACK_TYPE', metadata.type],
    ['FEATURED_ARTISTS', metadata.featuredArtists],
    ['ALL_ARTISTS', metadata.allArtists],
    ['LYRICS_ID', metadata.lyricsId],
    ['LYRICS_FORMAT', metadata.lyrics ? 'LRC' : '']
  ]
  customMetadata.forEach(([key, val]) => {
    const box = freeformItemBox(key, val)
    if (box) items.push(box)
  })

  const ilst = makeBox('ilst', joinBytes(items))
  const hdlr = makeBox('hdlr', joinBytes([
    new Uint8Array(8),
    new TextEncoder().encode('mdir'),
    new TextEncoder().encode('appl'),
    new Uint8Array(9)
  ]))

  function replaceMeta(metaAtom) {
    const prefixStart = metaAtom.start + metaAtom.header
    const childStart = prefixStart + 4
    const prefix = audioBytes.subarray(prefixStart, childStart)
    const preserved = readAtoms(audioBytes, childStart, metaAtom.end)
      .filter((child) => child.type !== 'hdlr' && child.type !== 'ilst')
      .map((child) => audioBytes.subarray(child.start, child.end))
    return makeBox('meta', joinBytes([prefix, hdlr, ...preserved, ilst]))
  }

  function replaceUdta(udtaAtom) {
    const children = readAtoms(audioBytes, udtaAtom.start + udtaAtom.header, udtaAtom.end)
    const existingMeta = children.find((child) => child.type === 'meta')
    const contents = children
      .filter((child) => child !== existingMeta)
      .map((child) => audioBytes.subarray(child.start, child.end))
    contents.push(existingMeta ? replaceMeta(existingMeta) : makeBox('meta', joinBytes([new Uint8Array(4), hdlr, ilst])))
    return makeBox('udta', joinBytes(contents))
  }

  const moovChildren = readAtoms(audioBytes, moov.start + moov.header, moov.end)
  const existingUdta = moovChildren.find((child) => child.type === 'udta')
  const moovContents = moovChildren
    .filter((child) => child !== existingUdta)
    .map((child) => audioBytes.subarray(child.start, child.end))
  moovContents.push(existingUdta ? replaceUdta(existingUdta) : makeBox('udta', makeBox('meta', joinBytes([new Uint8Array(4), hdlr, ilst]))))

  const rewrittenMoov = makeBox('moov', joinBytes(moovContents))
  const delta = rewrittenMoov.length - moov.size
  shiftChunkOffsets(rewrittenMoov, delta, moov.end)

  const output = new Uint8Array(audioBytes.length + delta)
  output.set(audioBytes.subarray(0, moov.start), 0)
  output.set(rewrittenMoov, moov.start)
  output.set(audioBytes.subarray(moov.end), moov.start + rewrittenMoov.length)
  return output
}

export async function resolveTrackDetails(track) {
  if (track.detailsLoaded) return track
  const response = await fetch(apiUrl('/api/songs/' + encodeURIComponent(track.id)))
  if (!response.ok) throw new Error('Song details could not be loaded (' + response.status + ').')
  const json = await response.json()
  const fullItem = json.data && json.data[0]
  const details = fullItem && normalizeTrack(fullItem)
  if (!details || !details.downloadUrl.length) throw new Error('No audio stream is available for this song.')

  Object.assign(track, details, { detailsLoaded: true })
  return track
}

export async function downloadTrackWithMetadata(track, lyricsMode = 'embed', onProgress = () => {}) {
  onProgress('Loading song details...')
  await resolveTrackDetails(track)

  const audioUrl = getAudioUrlFromTrack(track, '320kbps')
  if (!audioUrl) throw new Error('No audio URL found for download')

  onProgress('Downloading audio stream...')
  const audioRes = await fetch(apiUrl('/api/download?url=' + encodeURIComponent(audioUrl) + '&filename=track.m4a'))
  if (!audioRes.ok) throw new Error('Unable to download audio stream (' + audioRes.status + ').')
  const audioBytes = new Uint8Array(await audioRes.arrayBuffer())
  if (audioBytes.length < 12) throw new Error('Incomplete audio file received.')

  onProgress('Fetching high-resolution cover art...')
  const imgUrl = track.coverImage || track.image
  if (!imgUrl) throw new Error('Cover art is not available for this song.')
  const imgRes = await fetch(apiUrl('/api/download?url=' + encodeURIComponent(imgUrl) + '&filename=cover'))
  if (!imgRes.ok) throw new Error('Unable to download cover art (' + imgRes.status + ').')
  const imgBytes = new Uint8Array(await imgRes.arrayBuffer())

  const isPng = imgBytes.length >= 8 &&
    imgBytes[0] === 0x89 && imgBytes[1] === 0x50 &&
    imgBytes[2] === 0x4e && imgBytes[3] === 0x47 &&
    imgBytes[4] === 0x0d && imgBytes[5] === 0x0a &&
    imgBytes[6] === 0x1a && imgBytes[7] === 0x0a
  const isJpeg = imgBytes.length >= 3 &&
    imgBytes[0] === 0xff && imgBytes[1] === 0xd8 && imgBytes[2] === 0xff

  if (!isPng && !isJpeg) throw new Error('The cover image is not a supported JPEG or PNG file.')
  const coverType = isPng ? 14 : 13

  let lyricsContent = ''
  let lyricsUnavailable = false
  if (lyricsMode !== 'none') {
    onProgress('Retrieving synchronized lyrics...')
    try {
      const lyrRes = await fetch(apiUrl('/api/songs/' + encodeURIComponent(track.id) + '/lyrics'))
      if (lyrRes.ok) {
        const lyrJson = await lyrRes.json()
        lyricsContent = cleanLyrics((lyrJson.data && (lyrJson.data.lyrics || lyrJson.data.lyrics_text)) || '')
      }
    } catch (e) {
      console.warn('Lyrics fetch warning:', e)
    }
    lyricsUnavailable = !lyricsContent
  }

  onProgress('Tagging MP4 container with artwork & metadata...')
  const tagged = tagMp4(audioBytes, {
    title: track.name || 'Untitled',
    artist: track.artist || 'Various Artists',
    albumArtist: track.artist || 'Various Artists',
    album: (track.album && track.album.name) || 'Single',
    year: track.year || '',
    releaseDate: track.releaseDate || track.year || '',
    label: track.label || '',
    copyright: track.copyright || '',
    language: track.language || '',
    playCount: track.playCount,
    explicitContent: Boolean(track.explicitContent),
    trackId: track.id || '',
    trackUrl: track.url || '',
    albumId: (track.album && track.album.id) || '',
    albumUrl: (track.album && track.album.url) || '',
    duration: track.duration || '',
    type: track.type || 'song',
    featuredArtists: track.featuredArtists || '',
    allArtists: track.allArtists || '',
    lyricsId: track.lyricsId || '',
    lyrics: lyricsMode === 'embed' ? createLrcFile(lyricsContent, track) : '',
    cover: imgBytes,
    coverType
  })

  const blob = new Blob([tagged], { type: 'audio/mp4' })
  const safeStem = (track.name + ' - ' + track.artist)
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 120) || 'track'
  const safeName = safeStem + '.m4a'

  const audioObjectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = audioObjectUrl
  a.download = safeName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(audioObjectUrl), 60000)

  if (lyricsMode === 'separate' && lyricsContent) {
    const lrcBlob = new Blob([createLrcFile(lyricsContent, track)], { type: 'text/plain;charset=utf-8' })
    const lrcObjectUrl = URL.createObjectURL(lrcBlob)
    const lrcA = document.createElement('a')
    lrcA.href = lrcObjectUrl
    lrcA.download = safeName.replace(/\.m4a$/, '.lrc')
    document.body.appendChild(lrcA)
    lrcA.click()
    lrcA.remove()
    setTimeout(() => URL.revokeObjectURL(lrcObjectUrl), 60000)
  }

  return { lyricsUnavailable }
}
