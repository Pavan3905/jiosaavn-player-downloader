import React from 'react'
import { Search, Sliders, Moon, Disc3, X } from 'lucide-react'

export function Header({
  searchQuery,
  onSearchChange,
  onSearchClear,
  onOpenEq,
  onOpenTimer,
  onOpenQuality,
  timerLabel,
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
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
        {searchQuery && (
          <button className="search-clear" onClick={onSearchClear} title="Clear">
            <X size={15} />
          </button>
        )}
        <span className="search-shortcut-badge">/</span>
      </div>

      <div className="top-controls">
        <button className="btn-pill" onClick={onOpenEq} title="Equalizer">
          <Sliders size={15} />
          <span>Equalizer</span>
        </button>
        <button className="btn-pill" onClick={onOpenTimer} title="Sleep Timer">
          <Moon size={15} />
          <span>{timerLabel}</span>
        </button>
        <button className="btn-pill" onClick={onOpenQuality} title="Audio Quality">
          <Disc3 size={15} />
          <span>{qualityLabel}</span>
        </button>
      </div>
    </header>
  )
}
