import React, { useRef } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  FileText,
  Download
} from 'lucide-react'
import { formatDuration } from '../utils/helpers.js'

export function Player({
  currentTrack,
  isPlaying,
  shuffle,
  repeat,
  volume,
  currentTime,
  duration,
  streamQuality,
  onTogglePlayPause,
  onPlayPrev,
  onPlayNext,
  onToggleShuffle,
  onToggleRepeat,
  onSeek,
  onVolumeChange,
  onToggleLyrics,
  onToggleQueue,
  onOpenDownload,
  visualizerRef
}) {
  const progressBarRef = useRef(null)

  const handleProgressClick = (e) => {
    if (!duration || !progressBarRef.current) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, clickX / rect.width))
    onSeek(pct * duration)
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <footer className="player-bar">
      <div className="now-playing-meta">
        {currentTrack ? (
          <>
            <img
              className="now-playing-cover"
              src={currentTrack.image || 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'}
              alt=""
            />
            <div className="now-playing-text">
              <div className="now-playing-title">{currentTrack.name}</div>
              <div className="now-playing-artist">{currentTrack.artist}</div>
              <span className="quality-tag">{streamQuality} AAC</span>
            </div>
          </>
        ) : (
          <div className="now-playing-text">
            <div className="now-playing-title" style={{ color: 'var(--text-muted)' }}>
              No track playing
            </div>
            <div className="now-playing-artist">Select a song to start listening</div>
          </div>
        )}
      </div>

      <div className="transport-wrap">
        <div className="transport-controls">
          <button
            className={`transport-btn ${shuffle ? 'active' : ''}`}
            onClick={onToggleShuffle}
            title={shuffle ? 'Shuffle enabled' : 'Shuffle disabled'}
          >
            <Shuffle size={16} />
          </button>
          <button className="transport-btn" onClick={onPlayPrev} title="Previous">
            <SkipBack size={18} />
          </button>
          <button
            className="btn-play-master"
            onClick={onTogglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="transport-btn" onClick={onPlayNext} title="Next">
            <SkipForward size={18} />
          </button>
          <button
            className={`transport-btn ${repeat !== 'none' ? 'active' : ''}`}
            onClick={onToggleRepeat}
            title={repeat === 'one' ? 'Repeat One' : repeat === 'all' ? 'Repeat All' : 'Repeat Off'}
          >
            {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        <div className="scrub-container">
          <span className="time-code">{formatDuration(currentTime)}</span>
          <div className="progress-bar-wrap" ref={progressBarRef} onClick={handleProgressClick}>
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            <div className="progress-handle" style={{ left: `${progressPct}%` }} />
          </div>
          <span className="time-code">{formatDuration(duration)}</span>
        </div>
      </div>

      <div className="player-tools">
        <canvas ref={visualizerRef} className="visualizer-canvas" width={44} height={22} />

        <div className="vol-wrap">
          <button
            className="transport-btn"
            style={{ width: 24, height: 24 }}
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            className="vol-slider"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>

        <button className="transport-btn" onClick={onToggleLyrics} title="Synchronized Lyrics">
          <FileText size={16} />
        </button>
        <button className="transport-btn" onClick={onToggleQueue} title="Queue">
          <ListMusic size={16} />
        </button>
        <button
          className="transport-btn"
          onClick={() => currentTrack && onOpenDownload(currentTrack)}
          disabled={!currentTrack}
          title="Download Current Track"
        >
          <Download size={16} />
        </button>
      </div>
    </footer>
  )
}
