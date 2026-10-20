import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Header } from './components/Header.jsx'
import { TrackRow } from './components/TrackRow.jsx'
import { MusicCard } from './components/MusicCard.jsx'
import { Player } from './components/Player.jsx'
import { FullScreenPlayer } from './components/FullScreenPlayer.jsx'
import { CollectionHero } from './components/CollectionHero.jsx'
import { Toast } from './components/Toast.jsx'
import {
  normalizeTrack,
  getAudioUrlFromTrack,
  decodeHtmlEntities,
  apiUrl
} from './utils/helpers.js'
import { downloadTrackWithMetadata, resolveTrackDetails } from './utils/audioTagger.js'

export default function App() {
  const audioRef = useRef(new Audio())
  const searchInputRef = useRef(null)
  const isPlayingRef = useRef(false)
  const searchAbortCtrlRef = useRef(null)
  const searchTimerRef = useRef(null)
  const playPromiseRef = useRef(null)
  const topPlaylistsCacheRef = useRef([])

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
  const streamQuality = '320kbps'
  const streamMode = 'proxy'

  // Search & Content State
  const [searchQuery, setSearchQuery] = useState('')
  const [tracks, setTracks] = useState([])
  const [cards, setCards] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const sentinelRef = useRef(null)

  // View State
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  const [downloadingTrackId, setDownloadingTrackId] = useState(null)
  const [activeCollection, setActiveCollection] = useState(null)
  const [cachedCards, setCachedCards] = useState([])
  const [isDownloadingCollection, setIsDownloadingCollection] = useState(false)

  // Lock body scroll when Full Screen is open
  useEffect(() => {
    if (isFullScreenOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFullScreenOpen])

  // PWA Save as App / Install State
  const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      showToast('✓ JioSaavn installed as app!')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!installPrompt) {
      showToast('To save as app: Click the Install icon in your browser address bar or menu.')
      return
    }
    installPrompt.prompt()
    try {
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setInstallPrompt(null)
        showToast('Installing JioSaavn App...')
      }
    } catch {
      // ignore
    }
  }

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

  // Keep isPlayingRef updated and sync media session
  useEffect(() => {
    isPlayingRef.current = isPlaying
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

  // Direct 1-Click Download Handler with Visual Progress Animation
  const handleDirectDownload = async (track) => {
    if (!track || downloadingTrackId) return
    setDownloadingTrackId(track.id)
    showToast(`Downloading “${track.name}”...`)
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

  const handleGoToAlbum = (album) => {
    if (!album) return
    if (album.id) {
      handleCardClick(album.id, 'albums')
    } else if (album.name && album.name !== 'Single') {
      setActiveCollection(null)
      executeSearch(album.name, 0, false)
    }
  }

  // Fetch top, best genuine editorial playlists from JioSaavn
  const fetchTopPlaylists = async (pageNum = 0, append = false) => {
    if (!append) {
      if (searchAbortCtrlRef.current) searchAbortCtrlRef.current.abort()
      searchAbortCtrlRef.current = new AbortController()
      setIsLoading(true)
      setActiveCollection(null)
      setTracks([])
      if (pageNum === 0 && topPlaylistsCacheRef.current.length > 0) {
        setCards(topPlaylistsCacheRef.current)
        setIsLoading(false)
        setHasMore(true)
        return
      }
    } else {
      setIsLoadingMore(true)
      isLoadingMoreRef.current = true
    }

    const signal = searchAbortCtrlRef.current?.signal

    try {
      const queries =
        pageNum === 0
          ? ['trending', 'superhits', 'top hits', 'viral']
          : ['punjabi hits', 'telugu hits', 'tamil hits', 'romantic hits']

      const fetches = queries.map((q) =>
        fetch(apiUrl(`/api/search/playlists?query=${encodeURIComponent(q)}&limit=25`), { signal })
          .then((r) => (r.ok ? r.json() : { data: { results: [] } }))
          .catch(() => ({ data: { results: [] } }))
      )

      const responses = await Promise.all(fetches)
      const combined = []
      const seen = new Set()

      if (append) {
        cards.forEach((c) => seen.add(c.id))
      }

      for (const res of responses) {
        const list = res.data?.results || []
        for (const item of list) {
          if (!item || !item.id || seen.has(item.id)) continue
          if (item.songCount && item.songCount > 0) {
            seen.add(item.id)
            combined.push(item)
          }
        }
      }

      setPage(pageNum)
      setHasMore(combined.length > 0)

      if (append) {
        setCards((prev) => [...prev, ...combined])
      } else {
        setCards(combined)
        topPlaylistsCacheRef.current = combined
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast('Could not load top playlists', true)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      isLoadingMoreRef.current = false
    }
  }

  // Search songs when query is present
  const executeSearch = async (query, pageNum = 0, append = false) => {
    const trimmed = (query || '').trim()
    if (!trimmed) {
      fetchTopPlaylists(0, false)
      return
    }

    if (!append) {
      if (searchAbortCtrlRef.current) searchAbortCtrlRef.current.abort()
      searchAbortCtrlRef.current = new AbortController()
      setIsLoading(true)
      setActiveCollection(null)
      setCards([])
    } else {
      setIsLoadingMore(true)
      isLoadingMoreRef.current = true
    }

    const signal = searchAbortCtrlRef.current?.signal

    try {
      const res = await fetch(
        apiUrl(`/api/search/songs?query=${encodeURIComponent(trimmed)}&page=${pageNum}&limit=25`),
        { signal }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rawResults = json.data?.results || []
      const normalized = rawResults.map(normalizeTrack).filter(Boolean)

      setPage(pageNum)
      setHasMore(normalized.length > 0)

      if (append) {
        setTracks((prev) => {
          const seen = new Set(prev.map((t) => t.id))
          const fresh = normalized.filter((t) => !seen.has(t.id))
          return [...prev, ...fresh]
        })
        setQueue((prev) => {
          const seen = new Set(prev.map((t) => t.id))
          const fresh = normalized.filter((t) => !seen.has(t.id))
          return [...prev, ...fresh]
        })
      } else {
        setTracks(normalized)
        setQueue(normalized)
        setCards([])
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast('Could not load search results', true)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      isLoadingMoreRef.current = false
    }
  }

  // Infinite Scroll Auto-loader on Scroll
  const handleLoadMore = useCallback(() => {
    if (
      isLoading ||
      isLoadingMoreRef.current ||
      !hasMore ||
      activeCollection
    ) {
      return
    }
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    if (searchQuery.trim()) {
      executeSearch(searchQuery, page + 1, true)
    } else {
      fetchTopPlaylists(page + 1, true)
    }
  }, [isLoading, hasMore, activeCollection, searchQuery, page])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore()
        }
      },
      {
        root: null,
        rootMargin: '450px',
        threshold: 0
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleLoadMore])

  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 600
      ) {
        handleLoadMore()
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [handleLoadMore])

  // Debounced search on query change
  const handleSearchChange = (val) => {
    setSearchQuery(val)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      if (!val.trim()) {
        fetchTopPlaylists(0, false)
      } else {
        executeSearch(val, 0, false)
      }
    }, 400)
  }

  const handleSearchClear = () => {
    setSearchQuery('')
    setActiveCollection(null)
    fetchTopPlaylists(0, false)
  }

  // Load Album / Playlist / Artist details
  const handleCardClick = async (id, type = 'playlists') => {
    setIsLoading(true)
    if (cards.length > 0) {
      setCachedCards(cards)
    }
    try {
      const endpoint = apiUrl(`/api/${type}?id=${encodeURIComponent(id)}${type === 'playlists' ? '&limit=100' : ''}`)
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
        name: decodeHtmlEntities(data.name || data.title || 'Collection'),
        image: imgUrl,
        year: data.year || '',
        artist: artistNames,
        songCount: normalized.length,
        description: decodeHtmlEntities(data.description || '')
      }

      setActiveCollection(colObj)
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
    setTracks([])
    if (topPlaylistsCacheRef.current.length > 0) {
      setCards(topPlaylistsCacheRef.current)
    } else if (cachedCards.length > 0) {
      setCards(cachedCards)
    } else {
      fetchTopPlaylists(0, false)
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

  // Initial load: Top genuine playlists
  useEffect(() => {
    fetchTopPlaylists(0, false)
  }, [])



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
      } else if (e.key === 's' || e.key === 'S') {
        setShuffle((prev) => !prev)
      } else if (e.key === 'r' || e.key === 'R') {
        setRepeat((prev) => (prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none'))
      } else if (e.key === 'Escape') {
        setIsFullScreenOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTrack])

  return (
    <div className="app-layout">
      <main className={`main-content ${currentTrack ? 'has-player' : ''}`}>
        <Header
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearchClear={handleSearchClear}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          searchInputRef={searchInputRef}
          installPrompt={installPrompt}
          onInstallApp={handleInstallApp}
        />

        {/* Collection Hero if viewing an album or playlist */}
        {activeCollection && (
          <CollectionHero
            collection={activeCollection}
            onBack={handleBackFromCollection}
            onPlayAll={handlePlayCollection}
            onShuffleAll={handleShuffleCollection}
            onDownloadAll={handleDownloadCollection}
            isDownloadingAll={isDownloadingCollection}
          />
        )}

        {/* Tracks Table (Rendered for songs search OR when viewing an active collection) */}
        {tracks.length > 0 && (activeCollection || searchQuery.trim()) && (
          <div className="track-table">
            {tracks.map((track, idx) => (
              <TrackRow
                key={`${track.id}-${idx}`}
                track={track}
                index={idx}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                onPlay={() => playTrackAtIndex(idx)}
                onDownload={(t) => handleDirectDownload(t)}
                onAlbumClick={(albumId) => handleCardClick(albumId, 'albums')}
                isDownloading={downloadingTrackId === track.id}
              />
            ))}
          </div>
        )}

        {/* Top Genuine Playlists Grid (Default view: no heading, just top genuine playlists) */}
        {cards.length > 0 && !activeCollection && !searchQuery.trim() && (
          <div className="card-grid">
            {cards.map((item) => (
              <MusicCard
                key={item.id}
                item={item}
                type="playlists"
                onClick={(id) => handleCardClick(id, 'playlists')}
              />
            ))}
          </div>
        )}

        {/* Infinite Scroll trigger & loading spinner on scroll */}
        {hasMore && !activeCollection && (
          <div ref={sentinelRef} className="infinite-scroll-sentinel">
            <div className="infinite-scroll-loader">
              <Loader2 size={18} className="spin-loader" />
              <span>Loading more playlists...</span>
            </div>
          </div>
        )}

        {/* Shimmer Skeleton Loading */}
        {isLoading && tracks.length === 0 && cards.length === 0 && (
          <div className="skeleton-container">
            {searchQuery.trim() ? (
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
                {[...Array(12)].map((_, i) => (
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
            <p>Try searching for a different song or playlist name.</p>
          </div>
        )}

        {/* Content bottom spacer to ensure elements are never hidden behind fixed player bar */}
        {currentTrack && <div className="content-bottom-spacer" aria-hidden="true" />}
      </main>

      {/* Fixed Bottom Player: Only shown when user has selected & is listening/paused */}
      {currentTrack && (
        <Player
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          shuffle={shuffle}
          repeat={repeat}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
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
          onDownload={(t) => handleDirectDownload(t)}
          onOpenFullScreen={() => setIsFullScreenOpen(true)}
          onGoToAlbum={handleGoToAlbum}
          isDownloading={downloadingTrackId === currentTrack?.id}
        />
      )}

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
        onDownload={(t) => handleDirectDownload(t)}
        onGoToAlbum={handleGoToAlbum}
        isDownloading={downloadingTrackId === currentTrack?.id}
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
