import React from 'react'

export function Toast({ message, isError, isVisible }) {
  return (
    <div className={`toast-msg ${isVisible ? 'show' : ''} ${isError ? 'error' : ''}`}>
      {message}
    </div>
  )
}
