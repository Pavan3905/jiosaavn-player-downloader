import React from 'react'
import { X, Trash2 } from 'lucide-react'

export function QueueDrawer({
  isOpen,
  queue,
  currentIndex,
  onClose,
  onPlayIndex,
  onRemoveIndex,
  onClearQueue
}) {
  return (
    <div className={`drawer-overlay ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">Queue ({queue.length})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {queue.length > 0 && (
              <button
                className="btn-pill"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={onClearQueue}
                title="Clear Queue"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
            <button className="drawer-close" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="drawer-body">
          {queue.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
              Your queue is empty.
            </p>
          ) : (
            queue.map((track, idx) => {
              const isCurrent = idx === currentIndex
              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`queue-item ${isCurrent ? 'current' : ''}`}
                  onClick={() => onPlayIndex(idx)}
                >
                  <img
                    className="queue-thumb"
                    src={track.image || 'https://www.jiosaavn.com/_i/3.0/artist-default-music.png'}
                    alt=""
                    loading="lazy"
                  />
                  <div className="queue-meta">
                    <div className="queue-title">{track.name}</div>
                    <div className="queue-sub">{track.artist}</div>
                  </div>
                  <button
                    className="row-action-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveIndex(idx)
                    }}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </aside>
    </div>
  )
}
