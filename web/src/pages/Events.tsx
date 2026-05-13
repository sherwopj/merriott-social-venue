import { useState } from 'react'
import { weekdayOrder, weekdayLabels, weeklyEvents } from '../data/weeklyEvents'

export function Events() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  return (
    <section className="section">
      <div className="container">
        <h1 className="page-title">Weekly events</h1>
        <p className="lede">
          Regular happenings through the week. Times can vary — check at the bar or on our notices
          for the latest.
        </p>
        <ul className="events-week">
          {weekdayOrder.map((day) => {
            const events = weeklyEvents[day]
            return (
              <li key={day} className="events-day">
                <h2 className="events-day__label">{weekdayLabels[day]}</h2>
                {events && events.length > 0 ? (
                  <div className="events-day__grid">
                    {events.map((ev, idx) => (
                      <article key={`${day}-${idx}`} className="events-card">
                        <button
                          className="events-card__media-btn"
                          onClick={() => setSelectedImage(ev.image)}
                          aria-label={`View full size image for ${ev.title}`}
                        >
                          <div className="events-card__media">
                            <img src={ev.image} alt={ev.title} loading="lazy" decoding="async" />
                            <div className="events-card__zoom-hint">Click to enlarge</div>
                          </div>
                        </button>
                        <div className="events-card__body">
                          <button
                            className="events-card__title-btn"
                            onClick={() => setSelectedImage(ev.image)}
                          >
                            <h3>{ev.title}</h3>
                          </button>
                          <p>{ev.description}</p>
                          {ev.note && (
                            <p className="events-card__note">
                              <strong>Note:</strong> {ev.note}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted events-day__empty">No regular event — see notices for specials.</p>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {selectedImage && (
        <div className="lightbox" onClick={() => setSelectedImage(null)} role="dialog" aria-modal="true">
          <div className="lightbox__content">
            <img src={selectedImage} alt="Full size event poster" />
            <button className="lightbox__close" onClick={() => setSelectedImage(null)} aria-label="Close lightbox">
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
