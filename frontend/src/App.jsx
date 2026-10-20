import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Header } from './components/Header.jsx'
import { FilterBar } from './components/FilterBar.jsx'
import { TrackRow } from './components/TrackRow.jsx'
import { MusicCard } from './components/MusicCard.jsx'
import { Player } from './components/Player.jsx'
import { FullScreenPlayer } from './components/FullScreenPlayer.jsx'
import { CollectionHero } from './components/CollectionHero.jsx'
import { QueueDrawer } from './components/QueueDrawer.jsx'
import { QualityModal } from './components/Modals.jsx'
import { Toast } from './components/Toast.jsx'
import {
  normalizeTrack,
  getAudioUrlFromTrack,
  decodeHtmlEntities,
  apiUrl
} from './utils/helpers.js'
import { downloadTrackWithMetadata, resolveTrackDetails } from './utils/audioTagger.js'
import { initWebAudio, triggerVisualizer } from './utils/audioContext.js'

export default function App() {
  const audioRef = useRef(new Audio())
  const searchInputRef = useRef(null)
  const visualizerCanvasRef = useRef(null)
  const isPlayingRef = useRef(false)
  const searchAbortCtrlRef = useRef(null)
  const searchTimerRef = useRef(null)
  const playPromiseRef = useRef(null)

  // Theme State (Dark / Light)
  const [theme, setTheme] = useState(() => localStorage.getItem('saavn_theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('saavn_theme', theme)
  }, [theme])

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

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
  const [isLoading, setIsLoading] = useState(true)
  const [stageTitle, setStageTitle] = useState('Discover')
  const [resultsCount, setResultsCount] = useState('')

  // Modals & Drawers State
  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [isQualityOpen, setIsQualityOpen] = useState(false)
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  const [downloadingTrackId, setDownloadingTrackId] = useState(null)
  const [activeCollection, setActiveCollection] = useState(null)
  const [cachedCards, setCachedCards] = useState([])
  const [isDownloadingCollection, setIsDownloadingCollection] = useState(false)

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
      const { repeat: rep } = stateRef.current
      if (rep === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => {})
      } else {
        handlePlayNext()
      }
    }
    const handleError = () => {
      if (audio.src) {
        showToast('Playback encountered a network error. Trying fallback...', true)
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
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
              const suggestions = (json.data || []).map(normalizeTrack).filter(Boolean)
              if (suggestions.length > 0) {
                const updatedQueue = [...q, ...suggestions]
                setQueue(updatedQueue)
                playTrackAtIndex(q.length, updatedQueue)
                showToast(`Radio: Added ${suggestions.length} recommendations to queue`)
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

  // Direct 1-Click Download Handler with Visual Progress Animation
  const handleDirectDownload = async (track) => {
    if (!track || downloadingTrackId) return
    setDownloadingTrackId(track.id)
    showToast(`Downloading “${track.name}” (320kbps M4A)...`)
    try {
      await downloadTrackWithMetadata(track, 'none', (msg) => {
        showToast(msg)
      })
      showToast(`✓ Download Complete: “${track.name}”`)
    } catch (err) {
      showToast(err.message || 'Download failed', true)
    } finally {
      setDownloadingTrackId(null)
    }
  }

  // Search Execution
  const executeSearch = async (query, scope = activeScope, pageNum = 0, append = false) => {
    if (!query.trim()) query = 'top hits'

    if (!append) {
      if (searchAbortCtrlRef.current) searchAbortCtrlRef.current.abort()
      searchAbortCtrlRef.current = new AbortController()
      setIsLoading(true)
      setActiveCollection(null)
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

        setPage(pageNum)
        setHasMore(normalized.length >= 15)

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
    setActiveCollection(null)
    executeSearch('top hits', activeScope, 0, false)
  }

  const handleScopeChange = (newScope) => {
    setActiveCollection(null)
    setActiveScope(newScope)
    executeSearch(searchQuery || 'top hits', newScope, 0, false)
  }

  // Load Album / Playlist / Artist details
  const handleCardClick = async (id, type) => {
    setIsLoading(true)
    setStageTitle('Loading...')
    setResultsCount('Fetching...')
    if (cards.length > 0) {
      setCachedCards(cards)
    }
    try {
      const endpoint = apiUrl(`/api/${type}?id=${encodeURIComponent(id)}`)
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`${type} not found`)
      const json = await res.json()
      const data = json.data || {}
      const rawList = type === 'artists' ? data.topSongs || [] : data.songs || []
      const normalized = rawList.map(normalizeTrack).filter(Boolean)

      const imgUrl =
        (data.image && data.image[data.image.length - 1] && data.image[data.image.length - 1].url) ||
        (typeof data.image === 'string' ? data.image : '') ||
        ''
      const artistNames =
        (data.artists && data.artists.primary && data.artists.primary.map((a) => a.name).join(', ')) ||
        data.artist ||
        ''

      const colObj = {
        id: data.id || id,
        type,
        name: decodeHtmlEntities(data.name || 'Collection'),
        image: imgUrl,
        year: data.year || '',
        artist: artistNames,
        songCount: normalized.length,
        description: decodeHtmlEntities(data.description || '')
      }

      setActiveCollection(colObj)
      setStageTitle(colObj.name)
      setResultsCount(`${normalized.length} tracks`)
      setTracks(normalized)
      setQueue(normalized)
      setHasMore(false)
    } catch (err) {
      showToast(err.message || 'Could not load entity details', true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackFromCollection = () => {
    setActiveCollection(null)
    if (cachedCards.length > 0) {
      setCards(cachedCards)
      setTracks([])
      setStageTitle(searchQuery ? `“${searchQuery}”` : 'Featured Releases')
      setResultsCount(`${cachedCards.length} ${activeScope}`)
    } else {
      executeSearch(searchQuery || 'top hits', activeScope, 0, false)
    }
  }

  const handlePlayCollection = () => {
    if (tracks.length > 0) {
      setQueue(tracks)
      playTrackAtIndex(0, tracks)
      showToast(`Playing “${activeCollection?.name || 'Collection'}”`)
    }
  }

  const handleShuffleCollection = () => {
    if (tracks.length > 0) {
      setShuffle(true)
      setQueue(tracks)
      const randomIdx = Math.floor(Math.random() * tracks.length)
      playTrackAtIndex(randomIdx, tracks)
      showToast(`Shuffling “${activeCollection?.name || 'Collection'}”`)
    }
  }

  const handleDownloadCollection = async () => {
    if (!tracks.length || isDownloadingCollection) return
    setIsDownloadingCollection(true)
    showToast(`Downloading ${tracks.length} tracks from “${activeCollection?.name || 'Album'}”...`)
    let successCount = 0
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      setDownloadingTrackId(track.id)
      try {
        await downloadTrackWithMetadata(track, 'none')
        successCount++
        showToast(`Downloaded (${i + 1}/${tracks.length}): “${track.name}”`)
      } catch (err) {
        showToast(`Skipped “${track.name}”: ${err.message}`, true)
      }
    }
    setDownloadingTrackId(null)
    setIsDownloadingCollection(false)
    showToast(`✓ Completed download: ${successCount}/${tracks.length} tracks`)
  }

  // Initial load
  useEffect(() => {
    executeSearch('top hits', 'songs', 0, false)
  }, [])

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

  // Keyboard Shortcuts Listener (Standard intuitive shortcuts)
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
      } else if (e.key === 'f' || e.key === 'F') {
        if (currentTrack) setIsFullScreenOpen((prev) => !prev)
      } else if (e.key === 'q' || e.key === 'Q') {
        setIsQueueOpen((prev) => !prev)
      } else if (e.key === 's' || e.key === 'S') {
        setShuffle((prev) => !prev)
      } else if (e.key === 'r' || e.key === 'R') {
        setRepeat((prev) => (prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'))
      } else if (e.key === 'Escape') {
        setIsQueueOpen(false)
        setIsQualityOpen(false)
        setIsFullScreenOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTrack])

  return (
    <div className="app-layout">
      <main className="main-content">
        <Header
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearchClear={handleSearchClear}
          onOpenQuality={() => setIsQualityOpen(true)}
          qualityLabel={streamQuality.replace('kbps', 'K')}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          searchInputRef={searchInputRef}
        />

        <FilterBar activeScope={activeScope} onScopeChange={handleScopeChange} />

        {/* Collection Hero if viewing an album, playlist, or artist */}
        {activeCollection ? (
          <CollectionHero
            collection={activeCollection}
            onBack={handleBackFromCollection}
            onPlayAll={handlePlayCollection}
            onShuffleAll={handleShuffleCollection}
            onDownloadAll={handleDownloadCollection}
            isDownloadingAll={isDownloadingCollection}
          />
        ) : (
          <div className="section-meta">
            <h2 className="section-title">{stageTitle}</h2>
            <span className="section-badge">{resultsCount}</span>
          </div>
        )}

        {/* Tracks Table (Rendered for songs search OR when viewing an active collection) */}
        {tracks.length > 0 && (activeScope === 'songs' || activeCollection) && (
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
                onDownload={(t) => handleDirectDownload(t)}
                onAlbumClick={(albumId) => handleCardClick(albumId, 'albums')}
                isDownloading={downloadingTrackId === track.id}
              />
            ))}
          </div>
        )}

        {/* Card Grid (Albums, Playlists, Artists) when not viewing an active collection */}
        {cards.length > 0 && activeScope !== 'songs' && !activeCollection && (
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
        {hasMore && activeScope === 'songs' && !activeCollection && (
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

        {/* Shimmer Skeleton Loading */}
        {isLoading && tracks.length === 0 && cards.length === 0 && (
          <div className="skeleton-container">
            {activeScope === 'songs' ? (
              <div className="track-table">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="skeleton-row">
                    <div className="skeleton-block skeleton-idx"></div>
                    <div className="skeleton-block skeleton-thumb"></div>
                    <div className="skeleton-col">
                      <div className="skeleton-block skeleton-title"></div>
                      <div className="skeleton-block skeleton-sub"></div>
                    </div>
                    <div className="skeleton-block skeleton-album"></div>
                    <div className="skeleton-block skeleton-time"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card-grid">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-block skeleton-card-cover"></div>
                    <div className="skeleton-block skeleton-card-title"></div>
                    <div className="skeleton-block skeleton-card-desc"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && tracks.length === 0 && cards.length === 0 && !activeCollection && (
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
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        onDownload={(t) => handleDirectDownload(t)}
        onOpenFullScreen={() => setIsFullScreenOpen(true)}
        isDownloading={downloadingTrackId === currentTrack?.id}
        visualizerRef={visualizerCanvasRef}
      />

      {/* Full Screen Player Mode */}
      <FullScreenPlayer
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        shuffle={shuffle}
        repeat={repeat}
        volume={volume}
        currentTime={currentTime}
        duration={duration}
        streamQuality={streamQuality}
        isLiked={likedTracks.some((t) => t.id === currentTrack?.id)}
        onToggleLike={handleToggleLike}
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
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        onDownload={(t) => handleDirectDownload(t)}
        isDownloading={downloadingTrackId === currentTrack?.id}
        visualizerRef={visualizerCanvasRef}
      />

      {/* Queue Drawer */}
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

      {/* Quality Modal */}
      <QualityModal
        isOpen={isQualityOpen}
        onClose={() => setIsQualityOpen(false)}
        currentQuality={streamQuality}
        currentStreamMode={streamMode}
        onSetQuality={handleSetQuality}
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
