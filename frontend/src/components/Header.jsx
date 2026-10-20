import React from 'react'
import { Search, Disc3, Keyboard, X } from 'lucide-react'

export function Header({
  searchQuery,
  onSearchChange,
  onSearchClear,
  onOpenQuality,
  onOpenShortcuts,
  qualityLabel,
  searchInputRef
}) {
  return (
    <header className="top-header">
      <div className="search-box">
        <Search className="search-icon" size={16} />
        <input
          ref={searchInputRef}
          type="search"
          className="search-input"
          placeholder="Search songs, albums, artists, playlists..."
          aria-label="Search songs, albums, artists, playlists"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
        {searchQuery && (
          <button className="search-clear" onClick={onSearchClear} title="Clear" aria-label="Clear search input">
            <X size={15} />
          </button>
        )}
        <span className="search-shortcut-badge">/</span>
      </div>

      <div className="top-controls">
        <button
          className="btn-pill"
          onClick={onOpenQuality}
          title={`Audio Quality: ${qualityLabel}`}
          aria-label={`Audio Quality settings, currently: ${qualityLabel}`}
        >
          <Disc3 size={15} />
          <span className="btn-label">{qualityLabel}</span>
        </button>

        <button
          className="btn-pill"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts"
          aria-label="View Keyboard Shortcuts"
        >
          <Keyboard size={15} />
          <span className="btn-label">Shortcuts</span>
        </button>
      </div>
    </header>
  )
}
