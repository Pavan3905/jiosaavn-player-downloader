import React from 'react'
import { Play, Pause, Download, Loader2 } from 'lucide-react'
import { formatDuration } from '../utils/helpers.js'

export function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onDownload,
  onAlbumClick,
  isDownloading
}) {
  return (
    <div className={`track-row ${isCurrent ? 'playing' : ''}`}>
      <div className="track-idx">
        {isCurrent && isPlaying ? (
          <div className="now-playing-wave" title="Currently Playing">
            <span className="wave-bar bar-1"></span>
            <span className="wave-bar bar-2"></span>
            <span className="wave-bar bar-3"></span>
          </div>
        ) : (
          <span>{index + 1}</span>
        )}
        <button
          className="play-trigger"
          onClick={() => onPlay(track, index)}
          title={isCurrent && isPlaying ? 'Pause' : 'Play'}
          aria-label={isCurrent && isPlaying ? `Pause ${track.name}` : `Play ${track.name}`}
        >
          {isCurrent && isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
      </div>

      <div className="track-main" onClick={() => onPlay(track, index)}>
        <img
          className="track-thumb"
          src={track.image || 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'}
          alt={`${track.name} artwork`}
          loading="lazy"
          decoding="async"
        />
        <div className="track-info">
          <div className="track-title">{track.name}</div>
          <div className="track-subtitle">
            <span>{track.artist}</span>
            <span className="mobile-dur-tag"> • {formatDuration(track.duration)}</span>
          </div>
        </div>
      </div>

      <div
        className="track-album"
        title="View Album"
        onClick={() => track.album?.id && onAlbumClick(track.album.id)}
      >
        {track.album?.name || 'Single'}
      </div>

      <div className="track-duration">{formatDuration(track.duration)}</div>

      <div className="track-actions">
        <button
          className="row-action-btn"
          onClick={(e) => {
            e.stopPropagation()
            onDownload(track)
          }}
          disabled={isDownloading}
          title={isDownloading ? 'Downloading...' : 'Download Song'}
          aria-label={`Download ${track.name}`}
        >
          {isDownloading ? <Loader2 size={15} className="spin-loader" /> : <Download size={15} />}
        </button>
      </div>
    </div>
  )
}
