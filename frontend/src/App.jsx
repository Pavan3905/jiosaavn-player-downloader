import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Header } from './components/Header.jsx'
import { TrackRow } from './components/TrackRow.jsx'
import { MusicCard } from './components/MusicCard.jsx'
import { HomeShelf } from './components/HomeShelf.jsx'
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
  const homeShelvesCacheRef = useRef(null)

  const [theme, setTheme] = useState(() => (
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  ))

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const handleColorSchemeChange = (event) => {
      setTheme(event.matches ? 'dark' : 'light')
    }

    colorScheme.addEventListener('change', handleColorSchemeChange)
    return () => colorScheme.removeEventListener('change', handleColorSchemeChange)
  }, [])

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
  const [searchType, setSearchType] = useState('songs')
  const [tracks, setTracks] = useState([])
  const [cards, setCards] = useState([])
  const [homeShelves, setHomeShelves] = useState([])
  const [page, setPage] = useState(0)
  const [totalResults, setTotalResults] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const sentinelRef = useRef(null)

  // View State
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false)
  const [downloadingTrackIds, setDownloadingTrackIds] = useState(() => new Set())
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
  const playTrackAtIndex = useCallback(async (idx, customQueue = null) => {
    const list = customQueue || stateRef.current.queue
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
  }, [showToast])

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

  const handlePlayNext = useCallback(async () => {
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
  }, [playTrackAtIndex, showToast])

  const handlePlayPrev = useCallback(() => {
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
  }, [playTrackAtIndex])

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
  const handleDirectDownload = useCallback(async (track) => {
    if (!track || downloadingTrackIds.size > 0) return
    setDownloadingTrackIds((prev) => new Set(prev).add(track.id))
    showToast(`Downloading “${track.name}”...`)
    try {
      await downloadTrackWithMetadata(track, 'none', (msg) => {
        showToast(msg)
      })
      showToast(`✓ Download Complete: “${track.name}”`)
    } catch (err) {
      showToast(err.message || 'Download failed', true)
    } finally {
      setDownloadingTrackIds((prev) => {
        const next = new Set(prev)
        next.delete(track.id)
        return next
      })
    }
  }, [downloadingTrackIds, showToast])

  const handleGoToAlbum = (album) => {
    if (!album) return
    if (album.id) {
      handleCardClick(album.id, 'albums')
    } else if (album.name && album.name !== 'Single') {
      setActiveCollection(null)
      executeSearch(album.name, 0, false)
    }
  }

  const fetchHomeShelves = async (useCache = true) => {
    searchAbortCtrlRef.current?.abort()
    searchAbortCtrlRef.current = new AbortController()
    setIsLoading(true)
    setActiveCollection(null)
    setTracks([])
    setCards([])
    setHasMore(false)

    if (useCache && homeShelvesCacheRef.current) {
      setHomeShelves(homeShelvesCacheRef.current)
      setIsLoading(false)
      return
    }

    const sources = [
      { id: 'songs', title: 'Trending songs', query: 'trending songs' },
      { id: 'albums', title: 'Popular albums', query: 'latest hits' },
      { id: 'artists', title: 'Artists to know', query: 'popular singers' },
      { id: 'playlists', title: 'Top playlists', query: 'trending' }
    ]
    const { signal } = searchAbortCtrlRef.current

    try {
      const responses = await Promise.allSettled(sources.map(async (source) => {
        const response = await fetch(
          apiUrl(`/api/search/${source.id}?query=${encodeURIComponent(source.query)}&page=0&limit=12`),
          { signal }
        )
        if (!response.ok) throw new Error(`Could not load ${source.title.toLowerCase()}`)
        const json = await response.json()
        const results = json.data?.results || []
        return {
          ...source,
          items: source.id === 'songs' ? results.map(normalizeTrack).filter(Boolean) : results
        }
      }))
      const shelves = responses
        .filter((result) => result.status === 'fulfilled' && result.value.items.length > 0)
        .map((result) => result.value)
      if (shelves.length === 0 && responses.some((result) => result.status === 'rejected')) {
        throw new Error('Could not load music shelves')
      }
      setHomeShelves(shelves)
      homeShelvesCacheRef.current = shelves
    } catch (err) {
      if (err.name !== 'AbortError') {
        showToast(err.message || 'Could not load music shelves', true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Search songs when query is present
  const executeSearch = async (query, pageNum = 0, append = false, category = searchType) => {
    const trimmed = (query || '').trim()
    if (!trimmed) {
      fetchHomeShelves()
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
        apiUrl(`/api/search/${category}?query=${encodeURIComponent(trimmed)}&page=${pageNum}&limit=25`),
        { signal }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rawResults = json.data?.results || []
      const normalized = category === 'songs' ? rawResults.map(normalizeTrack).filter(Boolean) : rawResults
      const total = Number(json.data?.total) || 0

      setPage(pageNum)
      setTotalResults(total)
      setHasMore(total > (pageNum + 1) * 25 || normalized.length === 25)

      if (category === 'songs' && append) {
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
      } else if (category === 'songs') {
        setTracks(normalized)
        setQueue(normalized)
        setCards([])
      } else if (append) {
        setCards((prev) => {
          const seen = new Set(prev.map((item) => item.id))
          return [...prev, ...normalized.filter((item) => !seen.has(item.id))]
        })
        setTracks([])
      } else {
        setCards(normalized)
        setTracks([])
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
    executeSearch(searchQuery, page + 1, true, searchType)
  }, [isLoading, hasMore, activeCollection, searchQuery, searchType, page])

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

  // Debounced search on query change
  const handleSearchChange = (val) => {
    setSearchQuery(val)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      if (!val.trim()) {
        fetchHomeShelves()
      } else {
        executeSearch(val, 0, false, searchType)
      }
    }, 400)
  }

  const handleSearchSubmit = () => {
    clearTimeout(searchTimerRef.current)
    executeSearch(searchQuery, 0, false, searchType)
  }

  const handleSearchTypeChange = (type) => {
    setSearchType(type)
    if (!searchQuery.trim()) return
    clearTimeout(searchTimerRef.current)
    executeSearch(searchQuery, 0, false, type)
  }

  const handleSearchClear = () => {
    clearTimeout(searchTimerRef.current)
    searchAbortCtrlRef.current?.abort()
    setSearchQuery('')
    setActiveCollection(null)
    setTotalResults(0)
    fetchHomeShelves()
  }

  // Load Album / Playlist / Artist details
  const handleCardClick = useCallback(async (id, type = 'playlists') => {
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
  }, [cards, showToast])

  const handleHomeCardClick = useCallback((id, type, item) => {
    if (type !== 'songs') {
      handleCardClick(id, type)
      return
    }

    const songs = homeShelves.find((shelf) => shelf.id === 'songs')?.items || []
    const index = songs.findIndex((song) => song.id === id)
    if (index >= 0) {
      setQueue(songs)
      playTrackAtIndex(index, songs)
    } else if (item) {
      setQueue([item])
      playTrackAtIndex(0, [item])
    }
  }, [handleCardClick, homeShelves, playTrackAtIndex])

  const handleTrackPlay = useCallback((track, index) => {
    playTrackAtIndex(index)
  }, [playTrackAtIndex])

  const handleAlbumClick = useCallback((albumId) => {
    handleCardClick(albumId, 'albums')
  }, [handleCardClick])

  const handleCollectionTrackDownload = useCallback((track) => {
    return downloadTrackWithMetadata(track, 'none')
  }, [])

  const handleBackFromCollection = () => {
    setActiveCollection(null)
    setTracks([])
    if (cachedCards.length > 0) {
      setCards(cachedCards)
    } else {
      fetchHomeShelves()
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
    let completedCount = 0
    let nextIndex = 0
    const worker = async () => {
      while (nextIndex < tracks.length) {
        const index = nextIndex++
        const track = tracks[index]
        setDownloadingTrackIds((prev) => new Set(prev).add(track.id))
        try {
          await handleCollectionTrackDownload(track)
          successCount++
          completedCount++
          showToast(`Downloaded (${completedCount}/${tracks.length}): “${track.name}”`)
        } catch (err) {
          completedCount++
          showToast(`Skipped “${track.name}”: ${err.message}`, true)
        } finally {
          setDownloadingTrackIds((prev) => {
            const next = new Set(prev)
            next.delete(track.id)
            return next
          })
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(2, tracks.length) }, () => worker()))
      showToast(`✓ Completed download: ${successCount}/${tracks.length} tracks`)
    } finally {
      setIsDownloadingCollection(false)
    }
  }

  // Initial load: Top genuine playlists
  useEffect(() => {
    fetchHomeShelves()
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
          onSearchSubmit={handleSearchSubmit}
          onSearchClear={handleSearchClear}
          searchType={searchType}
          onSearchTypeChange={handleSearchTypeChange}
          isHome={!searchQuery.trim() && !activeCollection}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          searchInputRef={searchInputRef}
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

        {searchQuery.trim() && !activeCollection && (
          <div className="results-heading">
            <div>
              <p className="results-eyebrow">{searchType} · SEARCH RESULTS</p>
              <h2>Results for “{searchQuery.trim()}”</h2>
            </div>
            {!isLoading && totalResults > 0 && (
              <span className="results-count">{totalResults.toLocaleString()} found</span>
            )}
          </div>
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
                onPlay={handleTrackPlay}
                onDownload={handleDirectDownload}
                onAlbumClick={handleAlbumClick}
                isDownloading={downloadingTrackIds.has(track.id)}
              />
            ))}
          </div>
        )}

        {!searchQuery.trim() && !activeCollection && homeShelves.map((shelf) => (
          <HomeShelf key={shelf.id} shelf={shelf} onCardClick={handleHomeCardClick} />
        ))}

        {cards.length > 0 && !activeCollection && searchQuery.trim() && searchType !== 'songs' && (
          <div className="card-grid search-results-grid">
            {cards.map((item) => (
              <MusicCard
                key={item.id}
                item={item}
                type={searchQuery.trim() ? searchType : 'playlists'}
                onClick={handleCardClick}
              />
            ))}
          </div>
        )}

        {/* Infinite Scroll trigger & loading spinner on scroll */}
        {hasMore && !activeCollection && searchQuery.trim() && (
          <div ref={sentinelRef} className="infinite-scroll-sentinel">
            <div className="infinite-scroll-loader">
              <Loader2 size={18} className="spin-loader" />
              <span>Loading more {searchQuery.trim() ? searchType : 'playlists'}...</span>
            </div>
          </div>
        )}

        {/* Shimmer Skeleton Loading */}
        {isLoading && tracks.length === 0 && cards.length === 0 && homeShelves.length === 0 && (
          <div className={`skeleton-container ${searchQuery.trim() ? '' : 'home-shelf-skeletons'}`}>
            {searchQuery.trim() && searchType === 'songs' ? (
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
              searchQuery.trim() ? (
                <div className="card-grid">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-block skeleton-card-cover"></div>
                      <div className="skeleton-block skeleton-card-title"></div>
                      <div className="skeleton-block skeleton-card-desc"></div>
                    </div>
                  ))}
                </div>
              ) : (
                ['songs', 'albums', 'artists'].map((shelf) => (
                  <section className="home-shelf-skeleton" key={shelf}>
                    <div className="skeleton-block shelf-title-skeleton" />
                    <div className="home-shelf-rail">
                      {[...Array(6)].map((_, i) => (
                        <div className="shelf-card-skeleton" key={i}>
                          <div className="skeleton-block skeleton-card-cover" />
                          <div className="skeleton-block skeleton-card-title" />
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && tracks.length === 0 && cards.length === 0 && homeShelves.length === 0 && !activeCollection && (
          <div className="empty-box">
            <h3>{searchQuery.trim() ? 'No matches this time' : 'Nothing here yet'}</h3>
            <p>{searchQuery.trim()
              ? `Try another ${searchType === 'artists' ? 'artist' : searchType.slice(0, -1)} name or a shorter search.`
              : 'Your next favorite playlist is just around the corner.'}</p>
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
          onDownload={handleDirectDownload}
          onOpenFullScreen={() => setIsFullScreenOpen(true)}
          onGoToAlbum={handleGoToAlbum}
          isDownloading={downloadingTrackIds.has(currentTrack?.id)}
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
        onDownload={handleDirectDownload}
        onGoToAlbum={handleGoToAlbum}
        isDownloading={downloadingTrackIds.has(currentTrack?.id)}
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
