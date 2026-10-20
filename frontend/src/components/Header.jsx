import React from 'react'
import { Search, Sun, Moon, X } from 'lucide-react'

export function Header({
  searchQuery,
  onSearchChange,
  onSearchClear,
  theme,
  onToggleTheme,
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
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <span className="btn-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
  )
}
