import React from 'react'
import { ArrowLeft, Play, Shuffle, Download, Loader2, Music2, Disc3 } from 'lucide-react'

export function CollectionHero({
  collection,
  onBack,
  onPlayAll,
  onShuffleAll,
  onDownloadAll,
  isDownloadingAll
}) {
  if (!collection) return null

  const typeLabel =
    collection.type === 'albums'
      ? 'Album'
      : collection.type === 'playlists'
        ? 'Playlist'
        : collection.type === 'artists'
          ? 'Artist'
          : 'Collection'

  const artwork =
    collection.image ||
    'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'

  return (
    <div className="collection-hero">
      <button
        className="btn-back"
        onClick={onBack}
        title="Back to results"
        aria-label="Back to results"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      <div className="collection-main">
        <div className={`collection-cover-box ${collection.type === 'artists' ? 'artist-circle' : ''}`}>
          <img
            src={artwork}
            alt={collection.name}
            className="collection-art"
          />
        </div>

        <div className="collection-meta">
          <div className="collection-type-tag">
            {collection.type === 'albums' ? <Disc3 size={12} /> : <Music2 size={12} />}
            <span>{typeLabel}</span>
          </div>

          <h1 className="collection-title">{collection.name}</h1>

          <div className="collection-submeta">
            {collection.artist && (
              <span className="collection-artist">{collection.artist}</span>
            )}
            {collection.year && (
              <>
                <span className="dot-sep">•</span>
                <span className="collection-year">{collection.year}</span>
              </>
            )}
            {collection.songCount !== undefined && (
              <>
                <span className="dot-sep">•</span>
                <span className="collection-count">{collection.songCount} {collection.songCount === 1 ? 'song' : 'songs'}</span>
              </>
            )}
          </div>

          {collection.description && (
            <p className="collection-desc">{collection.description}</p>
          )}

          <div className="collection-actions">
            <button
              className="btn-collection-play"
              onClick={onPlayAll}
              title="Play All"
              aria-label={`Play all tracks in ${collection.name}`}
            >
              <Play size={18} fill="currentColor" />
              <span>Play All</span>
            </button>

            <button
              className="btn-collection-action"
              onClick={onShuffleAll}
              title="Shuffle Play"
              aria-label={`Shuffle play ${collection.name}`}
            >
              <Shuffle size={16} />
              <span>Shuffle</span>
            </button>

            {collection.songCount > 0 && onDownloadAll && (
              <button
                className="btn-collection-action"
                onClick={onDownloadAll}
                disabled={isDownloadingAll}
                title="Download all songs in album"
                aria-label={`Download all songs in ${collection.name}`}
              >
                {isDownloadingAll ? (
                  <Loader2 size={16} className="spin-loader" />
                ) : (
                  <Download size={16} />
                )}
                <span>{isDownloadingAll ? 'Downloading...' : 'Download All'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
