import React, { useEffect, useRef } from 'react'
import { X, Copy, Download } from 'lucide-react'

export function LyricsDrawer({
  isOpen,
  track,
  lyricsLines,
  currentTime,
  isLoading,
  onClose,
  onCopyLyrics,
  onExportLrc
}) {
  const containerRef = useRef(null)
  const activeLineRef = useRef(null)

  let activeIndex = -1
  if (lyricsLines.length) {
    for (let i = 0; i < lyricsLines.length; i++) {
      if (lyricsLines[i].time !== null && currentTime >= lyricsLines[i].time) {
        activeIndex = i
      }
    }
  }

  useEffect(() => {
    if (isOpen && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIndex, isOpen])

  return (
    <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">Lyrics {track ? `— ${track.name}` : ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lyricsLines.length > 0 && (
              <>
                <button
                  className="btn-pill"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={onCopyLyrics}
                  title="Copy Lyrics"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
                <button
                  className="btn-pill"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={onExportLrc}
                  title="Export .LRC"
                >
                  <Download size={13} />
                  <span>.LRC</span>
                </button>
              </>
            )}
            <button className="drawer-close" onClick={onClose} title="Close" aria-label="Close lyrics drawer">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="drawer-body" ref={containerRef}>
          {isLoading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              Fetching lyrics...
            </p>
          ) : lyricsLines.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              No synchronized lyrics available for this song.
            </p>
          ) : (
            <div className="lyrics-container">
              {lyricsLines.map((line, idx) => {
                const isActive = idx === activeIndex
                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    className={`lyric-line ${isActive ? 'active' : ''}`}
                  >
                    {line.text}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
