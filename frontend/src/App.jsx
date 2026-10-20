import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Header } from './components/Header.jsx'
import { FilterBar } from './components/FilterBar.jsx'
import { TrackRow } from './components/TrackRow.jsx'
import { MusicCard } from './components/MusicCard.jsx'
import { Player } from './components/Player.jsx'
import { QueueDrawer } from './components/QueueDrawer.jsx'
import { LyricsDrawer } from './components/LyricsDrawer.jsx'
import {
  EqualizerModal,
  SleepTimerModal,
  QualityModal,
  DownloadModal,
  ShortcutsModal
} from './components/Modals.jsx'
import { Toast } from './components/Toast.jsx'
import {
  normalizeTrack,
  getAudioUrlFromTrack,
  cleanLyrics,
  createLrcFile,
  decodeHtmlEntities,
  apiUrl
} from './utils/helpers.js'
import { downloadTrackWithMetadata, resolveTrackDetails } from './utils/audioTagger.js'
import { initWebAudio, setEqBandGain, triggerVisualizer } from './utils/audioContext.js'

export default function App() {
  const audioRef = useRef(new Audio())
  const searchInputRef = useRef(null)
  const visualizerCanvasRef = useRef(null)
  const isPlayingRef = useRef(false)
  const searchAbortCtrlRef = useRef(null)
  const searchTimerRef = useRef(null)
  const sleepTimeoutRef = useRef(null)
  const playPromiseRef = useRef(null)

  // Player State
  const [queue, setQueue] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('none')
  const [volume, setVolume] = useState(0.8)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [streamQuality, setStreamQuality] = useState(() => localStorage.getItem('saavn_quality') || '320kbps')
  const [streamMode, setStreamMode] = useState(() => localStorage.getItem('saavn_stream_mode') || 'proxy')
  const [likedTracks, setLikedTracks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('saavn_favorites')) || []
    } catch {
      return []
    }
  })

  // Search & Content State
  const [searchQuery, setSearchQuery] = useState('')
  const [activeScope, setActiveScope] = useState('songs')
  const [tracks, setTracks] = useState([])
  const [cards, setCards] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [stageTitle, setStageTitle] = useState('Discover')
  const [resultsCount, setResultsCount] = useState('')

  // Lyrics State
  const [rawLyrics, setRawLyrics] = useState('')
  const [lyricsLines, setLyricsLines] = useState([])
  const [isLyricsLoading, setIsLyricsLoading] = useState(false)

  // Equalizer State
  const [eqBandsState, setEqBandsState] = useState({ 60: 0, 250: 0, 1000: 0, 4000: 0, 12000: 0 })

  // Sleep Timer State
  const [sleepTimerValue, setSleepTimerValue] = useState('0')
  const [sleepTimerLabel, setSleepTimerLabel] = useState('Timer')

  // Modals & Drawers State
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isLyricsOpen, setIsLyricsOpen] = useState(false)
  const [isEqOpen, setIsEqOpen] = useState(false)
  const [isTimerOpen, setIsTimerOpen] = useState(false)
  const [isQualityOpen, setIsQualityOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [downloadModalTrack, setDownloadModalTrack] = useState(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')

  // Toast State
  const [toast, setToast] = useState({ message: '', isError: false, isVisible: false })
  const toastTimeoutRef = useRef(null)

  // Mutable ref bundle for keyboard handler to avoid listener churn
  const stateRef = useRef({
    volume,
    queue,
    currentIndex,
    repeat,
    shuffle,
    isPlaying
  })

  useEffect(() => {
    stateRef.current = {
      volume,
      queue,
      currentIndex,
      repeat,
      shuffle,
      isPlaying
    }
  }, [volume, queue, currentIndex, repeat, shuffle, isPlaying])

  const showToast = useCallback((message, isError = false) => {
    clearTimeout(toastTimeoutRef.current)
    setToast({ message, isError, isVisible: true })
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, isVisible: false }))
    }, 3000)
  }, [])

  // Keep isPlayingRef updated and sync visualizer
  useEffect(() => {
    isPlayingRef.current = isPlaying
    triggerVisualizer()
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
    }
  }, [isPlaying])

  // Media Session metadata update
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.name || 'Untitled',
      artist: currentTrack.artist || 'Various Artists',
      album: currentTrack.album?.name || 'Single',
      artwork: [
        { src: currentTrack.image || '', sizes: '150x150', type: 'image/jpeg' },
        { src: currentTrack.coverImage || currentTrack.image || '', sizes: '500x500', type: 'image/jpeg' }
      ]
    })
  }, [currentTrack])

  // Initialize Audio Listeners
  useEffect(() => {
    const audio = audioRef.current
    audio.volume = volume

    const handleTimeUpdate = () => {
      const curr = audio.currentTime
      const dur = audio.duration
      setCurrentTime(curr)

      // Pre-buffering: when current song reaches >85%, resolve next track in background
      if (dur > 0 && curr / dur > 0.85) {
        const { queue: q, currentIndex: cIdx } = stateRef.current
        if (cIdx + 1 < q.length && !q[cIdx + 1].detailsLoaded) {
          resolveTrackDetails(q[cIdx + 1]).catch(() => {})
        }
      }
    }
    const handleDurationChange = () => setDuration(audio.duration || 0)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      const { repeat: rep, sleepTimerValue: sleepVal } = stateRef.current
      if (rep === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else if (sleepVal === 'end-track') {
        setIsPlaying(false)
        setSleepTimerValue('0')
        setSleepTimerLabel('Timer')
        showToast('Playback paused at end of track.')
      } else {
        handlePlayNext()
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  // Online / Offline Network detection
  useEffect(() => {
    const handleOnline = () => showToast('Network connection restored.')
    const handleOffline = () => showToast('Network connection lost. Playback may stall.', true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [showToast])

  // Parse lyrics into timestamped lines
  const parseLyrics = (text) => {
    const clean = cleanLyrics(text)
    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed = []
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g

    lines.forEach((line) => {
      timeRegex.lastIndex = 0
      const match = timeRegex.exec(line)
      if (match) {
        const min = parseInt(match[1], 10)
        const sec = parseInt(match[2], 10)
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0
        const total = min * 60 + sec + ms / 1000
        const lineText = line.replace(/\[.*?\]/g, '').trim()
        if (lineText) parsed.push({ time: total, text: lineText })
      } else {
        parsed.push({ time: null, text: line })
      }
    })
    setLyricsLines(parsed)
  }

  // Fetch Lyrics for track
  const fetchLyrics = async (track) => {
    setIsLyricsLoading(true)
    setRawLyrics('')
    setLyricsLines([])
    try {
      const res = await fetch(apiUrl(`/api/songs/${encodeURIComponent(track.id)}/lyrics`))
      if (!res.ok) throw new Error('Lyrics not available')
      const json = await res.json()
      const text = json.data?.lyrics || json.data?.lyrics_text || ''
      if (!text) throw new Error('Lyrics not available')
      setRawLyrics(text)
      parseLyrics(text)
    } catch {
      setRawLyrics('')
      setLyricsLines([])
    } finally {
      setIsLyricsLoading(false)
    }
  }

  // Play track at queue index
  const playTrackAtIndex = async (idx, customQueue = null) => {
    const list = customQueue || queue
    if (idx < 0 || idx >= list.length) return
    const track = list[idx]
    setCurrentIndex(idx)
    setCurrentTrack(track)

    let audioUrl = getAudioUrlFromTrack(track, streamQuality)
    if (!audioUrl) {
      showToast('Resolving audio stream...')
      try {
        await resolveTrackDetails(track)
        audioUrl = getAudioUrlFromTrack(track, streamQuality)
      } catch (err) {
        showToast(err.message || 'Could not resolve audio stream', true)
        return
      }
    }

    if (!audioUrl) {
      showToast('Audio stream unavailable for this track', true)
      return
    }

    const audio = audioRef.current
    const finalStreamUrl = streamMode === 'direct' ? audioUrl : apiUrl(`/api/stream?url=${encodeURIComponent(audioUrl)}`)

    // Safe play protection against AbortError
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current
      } catch {
        // ignore interrupted previous play
      }
    }

    audio.src = finalStreamUrl

    // Init web audio once user interacts
    initWebAudio(audio, visualizerCanvasRef.current, isPlayingRef)

    playPromiseRef.current = audio.play()
    playPromiseRef.current
      .then(() => {
        setIsPlaying(true)
        fetchLyrics(track)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setIsPlaying(false)
          showToast('Playback was interrupted. Press Play to start.', true)
        }
      })
  }

  const handleTogglePlayPause = () => {
    const audio = audioRef.current
    if (!audio.src) {
      if (queue.length > 0) playTrackAtIndex(0)
      return
    }
    if (audio.paused) {
      playPromiseRef.current = audio.play()
      playPromiseRef.current
        .then(() => setIsPlaying(true))
        .catch((err) => {
          if (err.name !== 'AbortError') showToast('Could not resume playback', true)
        })
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const handlePlayNext = async () => {
    const { queue: q, currentIndex: cIdx, shuffle: shuf, repeat: rep } = stateRef.current
    if (!q.length) return
    let nextIdx
    if (shuf && q.length > 1) {
      nextIdx = Math.floor(Math.random() * q.length)
      if (nextIdx === cIdx) nextIdx = (nextIdx + 1) % q.length
    } else {
      nextIdx = cIdx + 1
    }

    if (nextIdx >= q.length) {
      if (rep === 'all') {
        playTrackAtIndex(0)
      } else {
        const curr = q[cIdx]
        if (curr && curr.id) {
          showToast('Radio Autoplay: Finding similar songs...')
          try {
            const res = await fetch(apiUrl(`/api/songs/${encodeURIComponent(curr.id)}/suggestions?limit=10`))
            if (res.ok) {
              const json = await res.json()
              const rawList = json.data || []
              const newTracks = rawList.map(normalizeTrack).filter(Boolean)
              if (newTracks.length) {
                setQueue((prev) => [...prev, ...newTracks])
                playTrackAtIndex(cIdx + 1, [...q, ...newTracks])
                showToast('Radio: Playing similar tracks.')
                return
              }
            }
          } catch {
            // fallback
          }
        }
        setIsPlaying(false)
      }
      return
    }
    playTrackAtIndex(nextIdx)
  }

  const handlePlayPrev = () => {
    const audio = audioRef.current
    const { queue: q, currentIndex: cIdx } = stateRef.current
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    if (cIdx > 0) {
      playTrackAtIndex(cIdx - 1)
    } else {
      playTrackAtIndex(q.length - 1)
    }
  }

  const handleSeek = (newTime) => {
    const audio = audioRef.current
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (newVol) => {
    const audio = audioRef.current
    audio.volume = newVol
    setVolume(newVol)
  }

  const handleToggleLike = (track) => {
    const exists = likedTracks.some((t) => t.id === track.id)
    let updated
    if (exists) {
      updated = likedTracks.filter((t) => t.id !== track.id)
      showToast('Removed from Favorites')
    } else {
      updated = [track, ...likedTracks]
      showToast('Added to Favorites')
    }
    setLikedTracks(updated)
    localStorage.setItem('saavn_favorites', JSON.stringify(updated))
  }

  const handleAddToQueue = (track) => {
    setQueue((prev) => [...prev, track])
    showToast(`Added to queue: ${track.name}`)
  }

  // Search Execution
  const executeSearch = async (query, scope = activeScope, pageNum = 0, append = false) => {
    if (!query.trim()) query = 'top hits'

    if (!append) {
      if (searchAbortCtrlRef.current) searchAbortCtrlRef.current.abort()
      searchAbortCtrlRef.current = new AbortController()
      setIsLoading(true)
      setStageTitle(query === 'top hits' ? 'Featured Releases' : `“${query}”`)
      setResultsCount('Searching...')
    }

    const signal = searchAbortCtrlRef.current?.signal

    try {
      if (scope === 'songs') {
        const res = await fetch(
          apiUrl(`/api/search/songs?query=${encodeURIComponent(query)}&page=${pageNum}&limit=15`),
          { signal }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const rawResults = json.data?.results || []
        const normalized = rawResults.map(normalizeTrack).filter(Boolean)

        setHasMore(normalized.length >= 15)
        setPage(pageNum)

        if (append) {
          setTracks((prev) => [...prev, ...normalized])
          setQueue((prev) => [...prev, ...normalized])
        } else {
          setTracks(normalized)
          setQueue(normalized)
          setCards([])
          setResultsCount(
            `${json.data?.total ? json.data.total.toLocaleString() : normalized.length} tracks`
          )
        }
      } else {
        const res = await fetch(
          apiUrl(`/api/search/${scope}?query=${encodeURIComponent(query)}&limit=24`),
          { signal }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const items = json.data?.results || []
        setCards(items)
        setTracks([])
        setHasMore(false)
        setResultsCount(`${items.length} ${scope}`)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast('Could not load search results', true)
        setResultsCount('Error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced search on query change
  const handleSearchChange = (val) => {
    setSearchQuery(val)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      executeSearch(val, activeScope, 0, false)
    }, 400)
  }

  const handleSearchClear = () => {
    setSearchQuery('')
    executeSearch('top hits', activeScope, 0, false)
  }

  const handleScopeChange = (newScope) => {
    setActiveScope(newScope)
    executeSearch(searchQuery || 'top hits', newScope, 0, false)
  }

  // Load Album / Playlist / Artist details
  const handleCardClick = async (id, type) => {
    setIsLoading(true)
    setStageTitle('Loading...')
    setResultsCount('Fetching...')
    try {
      const endpoint = apiUrl(`/api/${type}?id=${encodeURIComponent(id)}`)
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`${type} not found`)
      const json = await res.json()
      const data = json.data || {}
      const rawList = type === 'artists' ? data.topSongs || [] : data.songs || []
      const normalized = rawList.map(normalizeTrack).filter(Boolean)

      setStageTitle(decodeHtmlEntities(data.name || 'Collection'))
      setResultsCount(`${normalized.length} tracks`)
      setTracks(normalized)
      setQueue(normalized)
      setCards([])
      setHasMore(false)
    } catch (err) {
      showToast(err.message || 'Could not load entity details', true)
    } finally {
      setIsLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    executeSearch('top hits', 'songs', 0, false)
  }, [])

  // Equalizer Preset & Band Change
  const handleBandChange = (freq, val) => {
    setEqBandGain(freq, val)
    setEqBandsState((prev) => ({ ...prev, [freq]: val }))
  }

  const handlePresetApply = (vals) => {
    Object.keys(vals).forEach((f) => setEqBandGain(f, vals[f]))
    setEqBandsState(vals)
  }

  // Sleep Timer Handler
  const handleSetSleepTimer = (val) => {
    clearTimeout(sleepTimeoutRef.current)
    setSleepTimerValue(val)
    if (val === '0') {
      setSleepTimerLabel('Timer')
      showToast('Sleep timer disabled.')
    } else if (val === 'end-track') {
      setSleepTimerLabel('End Track')
      showToast('Playback will stop after the current song.')
    } else {
      const mins = parseInt(val, 10)
      setSleepTimerLabel(`${mins}m`)
      showToast(`Sleep timer set for ${mins} minutes.`)
      sleepTimeoutRef.current = setTimeout(() => {
        const audio = audioRef.current
        const fade = setInterval(() => {
          if (audio.volume > 0.1) audio.volume -= 0.1
          else {
            clearInterval(fade)
            audio.pause()
            setIsPlaying(false)
            audio.volume = volume
            setSleepTimerLabel('Timer')
            showToast('Sleep timer paused playback.')
          }
        }, 400)
      }, mins * 60 * 1000)
    }
    setIsTimerOpen(false)
  }

  // Stream Quality & Mode Handler
  const handleSetQuality = (quality, mode) => {
    setStreamQuality(quality)
    localStorage.setItem('saavn_quality', quality)
    if (mode) {
      setStreamMode(mode)
      localStorage.setItem('saavn_stream_mode', mode)
    }
    showToast(`Quality: ${quality}${mode === 'direct' ? ' (Direct CDN)' : ''}`)
    setIsQualityOpen(false)

    const audio = audioRef.current
    if (currentTrack && audio.src) {
      const prevTime = audio.currentTime
      const wasPaused = audio.paused
      const newUrl = getAudioUrlFromTrack(currentTrack, quality)
      if (newUrl) {
        audio.src = (mode || streamMode) === 'direct' ? newUrl : apiUrl(`/api/stream?url=${encodeURIComponent(newUrl)}`)
        audio.currentTime = prevTime
        if (!wasPaused) audio.play().catch(() => {})
      }
    }
  }

  // Download Handler
  const handleConfirmDownload = async (track, lyricsMode) => {
    setIsDownloading(true)
    setDownloadProgress('Starting...')
    try {
      const result = await downloadTrackWithMetadata(track, lyricsMode, (msg) => {
        setDownloadProgress(msg)
      })
      setIsDownloading(false)
      setDownloadModalTrack(null)
      showToast(
        result.lyricsUnavailable
          ? 'M4A downloaded with cover art; lyrics were unavailable.'
          : 'High-fidelity M4A download completed.'
      )
    } catch (err) {
      setIsDownloading(false)
      setDownloadProgress(`Error: ${err.message}`)
      showToast(err.message || 'Download failed', true)
    }
  }

  // Setup Media Session Action Handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return

    try {
      navigator.mediaSession.setActionHandler('play', () => handleTogglePlayPause())
      navigator.mediaSession.setActionHandler('pause', () => handleTogglePlayPause())
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePlayPrev())
      navigator.mediaSession.setActionHandler('nexttrack', () => handlePlayNext())
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) handleSeek(details.seekTime)
      })
    } catch {
      // mediaSession action assignment fallback
    }
  }, [])

  // Keyboard Shortcuts Listener (bound ONCE on mount with stateRef to eliminate churn)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.code === 'Space') {
        e.preventDefault()
        handleTogglePlayPause()
      } else if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'ArrowRight') {
        const audio = audioRef.current
        if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5)
      } else if (e.key === 'ArrowLeft') {
        const audio = audioRef.current
        if (audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 5)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        handleVolumeChange(Math.min(1, stateRef.current.volume + 0.05))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        handleVolumeChange(Math.max(0, stateRef.current.volume - 0.05))
      } else if (e.key === 'm' || e.key === 'M') {
        handleVolumeChange(stateRef.current.volume > 0 ? 0 : 0.8)
      } else if (e.key === 'l' || e.key === 'L') {
        setIsLyricsOpen((prev) => !prev)
      } else if (e.key === 'q' || e.key === 'Q') {
        setIsQueueOpen((prev) => !prev)
      } else if (e.key === 'e' || e.key === 'E') {
        setIsEqOpen((prev) => !prev)
      } else if (e.key === 's' || e.key === 'S') {
        setShuffle((prev) => !prev)
      } else if (e.key === 'r' || e.key === 'R') {
        setRepeat((prev) => (prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'))
      } else if (e.key === 'Escape') {
        setIsQueueOpen(false)
        setIsLyricsOpen(false)
        setIsEqOpen(false)
        setIsTimerOpen(false)
        setIsQualityOpen(false)
        setIsShortcutsOpen(false)
        setDownloadModalTrack(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="app-layout">
      <main className="main-content">
        <Header
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearchClear={handleSearchClear}
          onOpenEq={() => setIsEqOpen(true)}
          onOpenTimer={() => setIsTimerOpen(true)}
          onOpenQuality={() => setIsQualityOpen(true)}
          timerLabel={sleepTimerLabel}
          qualityLabel={streamQuality.replace('kbps', 'K')}
          searchInputRef={searchInputRef}
        />

        <FilterBar activeScope={activeScope} onScopeChange={handleScopeChange} />

        <div className="section-meta">
          <h2 className="section-title">{stageTitle}</h2>
          <span className="section-badge">{resultsCount}</span>
        </div>

        {/* Tracks Table */}
        {tracks.length > 0 && activeScope === 'songs' && (
          <div className="track-table">
            <div className="table-header">
              <span>#</span>
              <span>Title</span>
              <span>Album</span>
              <span style={{ textAlign: 'right' }}>Time</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {tracks.map((track, idx) => (
              <TrackRow
                key={`${track.id}-${idx}`}
                track={track}
                index={idx}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                isLiked={likedTracks.some((t) => t.id === track.id)}
                onPlay={() => playTrackAtIndex(idx)}
                onToggleLike={handleToggleLike}
                onAddToQueue={handleAddToQueue}
                onDownload={(t) => setDownloadModalTrack(t)}
                onAlbumClick={(albumId) => handleCardClick(albumId, 'albums')}
              />
            ))}
          </div>
        )}

        {/* Card Grid (Albums, Playlists, Artists) */}
        {cards.length > 0 && activeScope !== 'songs' && (
          <div className="card-grid">
            {cards.map((item) => (
              <MusicCard
                key={item.id}
                item={item}
                type={activeScope}
                onClick={handleCardClick}
              />
            ))}
          </div>
        )}

        {/* Infinite Scroll trigger for tracks */}
        {hasMore && activeScope === 'songs' && (
          <div className="lazy-spinner-wrap">
            <button
              className="btn-pill"
              onClick={() => executeSearch(searchQuery || 'top hits', 'songs', page + 1, true)}
              disabled={isLoading}
            >
              {isLoading ? 'Loading more...' : 'Load more tracks'}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && tracks.length === 0 && cards.length === 0 && (
          <div className="empty-box">
            <h3>No results found</h3>
            <p>Try searching for a different song, artist, album, or playlist name.</p>
          </div>
        )}
      </main>

      {/* Fixed Bottom Player */}
      <Player
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        shuffle={shuffle}
        repeat={repeat}
        volume={volume}
        currentTime={currentTime}
        duration={duration}
        streamQuality={streamQuality}
        onTogglePlayPause={handleTogglePlayPause}
        onPlayPrev={handlePlayPrev}
        onPlayNext={handlePlayNext}
        onToggleShuffle={() => {
          setShuffle((prev) => !prev)
          showToast(!shuffle ? 'Shuffle enabled' : 'Shuffle disabled')
        }}
        onToggleRepeat={() => {
          const next = repeat === 'none' ? 'all' : repeat === 'all' ? 'one' : 'none'
          setRepeat(next)
          showToast(next === 'one' ? 'Repeat one' : next === 'all' ? 'Repeat all' : 'Repeat off')
        }}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleLyrics={() => setIsLyricsOpen((prev) => !prev)}
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        onOpenDownload={(t) => setDownloadModalTrack(t)}
        visualizerRef={visualizerCanvasRef}
      />

      {/* Drawers */}
      <QueueDrawer
        isOpen={isQueueOpen}
        queue={queue}
        currentIndex={currentIndex}
        onClose={() => setIsQueueOpen(false)}
        onPlayIndex={(idx) => playTrackAtIndex(idx)}
        onRemoveIndex={(idx) => {
          setQueue((prev) => prev.filter((_, i) => i !== idx))
          if (idx === currentIndex) handlePlayNext()
          else if (idx < currentIndex) setCurrentIndex((prev) => prev - 1)
        }}
        onClearQueue={() => {
          setQueue(currentTrack ? [currentTrack] : [])
          setCurrentIndex(currentTrack ? 0 : -1)
          showToast('Queue cleared')
        }}
      />

      <LyricsDrawer
        isOpen={isLyricsOpen}
        track={currentTrack}
        lyricsLines={lyricsLines}
        currentTime={currentTime}
        isLoading={isLyricsLoading}
        onClose={() => setIsLyricsOpen(false)}
        onCopyLyrics={() => {
          if (rawLyrics) {
            navigator.clipboard.writeText(rawLyrics)
            showToast('Lyrics copied to clipboard.')
          }
        }}
        onExportLrc={() => {
          if (rawLyrics && currentTrack) {
            const lrc = createLrcFile(rawLyrics, currentTrack)
            const blob = new Blob([lrc], { type: 'text/plain;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${currentTrack.name || 'lyrics'}.lrc`
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 60000)
            showToast('LRC file exported.')
          }
        }}
      />

      {/* Modals */}
      <EqualizerModal
        isOpen={isEqOpen}
        onClose={() => setIsEqOpen(false)}
        eqBandsState={eqBandsState}
        onBandChange={handleBandChange}
        onPresetApply={handlePresetApply}
      />

      <SleepTimerModal
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        currentTimer={sleepTimerValue}
        onSetTimer={handleSetSleepTimer}
      />

      <QualityModal
        isOpen={isQualityOpen}
        onClose={() => setIsQualityOpen(false)}
        currentQuality={streamQuality}
        currentStreamMode={streamMode}
        onSetQuality={handleSetQuality}
      />

      <DownloadModal
        isOpen={Boolean(downloadModalTrack)}
        track={downloadModalTrack}
        onClose={() => setDownloadModalTrack(null)}
        onConfirmDownload={handleConfirmDownload}
        isDownloading={isDownloading}
        progressText={downloadProgress}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Toast Feedback */}
      <Toast
        message={toast.message}
        isError={toast.isError}
        isVisible={toast.isVisible}
      />
    </div>
  )
}
