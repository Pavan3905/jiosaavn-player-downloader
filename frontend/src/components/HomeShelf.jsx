import React, { memo, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MusicCard } from './MusicCard.jsx'

export const HomeShelf = memo(function HomeShelf({ shelf, onCardClick }) {
  const railRef = useRef(null)

  const scroll = (direction) => {
    railRef.current?.scrollBy({
      left: direction * Math.max(280, railRef.current.clientWidth * 0.75),
      behavior: 'smooth'
    })
  }

  return (
    <section className="home-shelf" aria-labelledby={`shelf-${shelf.id}`}>
      <div className="home-shelf-heading">
        <h2 id={`shelf-${shelf.id}`}>{shelf.title}</h2>
        <div className="shelf-controls">
          <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${shelf.title} left`}>
            <ChevronLeft size={17} />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${shelf.title} right`}>
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="home-shelf-rail" ref={railRef}>
        {shelf.items.map((item) => (
          <MusicCard
            key={item.id}
            item={item}
            type={shelf.id}
            onClick={onCardClick}
          />
        ))}
      </div>
    </section>
  )
})
