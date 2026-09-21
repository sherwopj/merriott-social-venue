import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { weekdayOrder, weekdayLabels, weeklyEvents } from '../data/weeklyEvents'
import { upcomingEvents as fallbackUpcomingEvents, type UpcomingEvent } from '../data/upcomingEvents'
import { EventIcon } from '../components/EventIcon'
import { apiUrl } from '../lib/apiBase'

type UpcomingEventsResponse = {
  sheetConfigured: boolean
  events: UpcomingEvent[]
}

function formatLongDate(startDate: string, endDate?: string) {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const start = new Date(`${startDate}T00:00:00`)
  const startLabel = start.toLocaleDateString('en-GB', options)

  if (endDate) {
    const end = new Date(`${endDate}T00:00:00`)
    return `${start.getDate()}–${end.toLocaleDateString('en-GB', options)}`
  }

  return startLabel
}

export function Events() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  // Show the bundled list immediately; silently upgrade to the live Google Sheet data
  // (fed by committee members via a Form) if/when it's reachable. If it isn't — API
  // asleep, sheet not set up yet, network hiccup — this bundled list stays on screen.
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>(fallbackUpcomingEvents)

  const loadUpcomingEvents = useCallback(() => {
    return fetch(apiUrl('/api/upcoming-events'))
      .then((res) => (res.ok ? (res.json() as Promise<UpcomingEventsResponse>) : null))
      .then((data) => {
        if (data?.sheetConfigured && data.events.length > 0) {
          setUpcomingEvents(data.events)
        }
      })
      .catch(() => {
        // Network/API error — keep showing whatever list is already on screen.
      })
  }, [])

  useEffect(() => {
    void loadUpcomingEvents()
  }, [loadUpcomingEvents])

  const sortedUpcoming = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return upcomingEvents
      .filter((ev) => new Date(`${ev.endDate ?? ev.startDate}T23:59:59`) >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [upcomingEvents])

  return (
    <section className="section">
      <div className="container container--wide">
        <h1 className="page-title">Events</h1>
        <p className="lede">
          Regular weekly happenings plus our upcoming calendar of discos, live music and special
          nights. Times can vary — check at the bar or on our notices for the latest.
        </p>

        <div className="events-columns">
          <div className="events-column events-column--upcoming">
            <div className="events-column__heading">
              <h2 className="section-title">Upcoming events</h2>
              <Link to="/admin" className="small muted">
                Committee member? Add an event →
              </Link>
            </div>

            <ul className="upcoming-events">
              {sortedUpcoming.map((ev) => {
                const image = ev.image
                return (
                  <li key={ev.id} className="upcoming-event">
                    {image ? (
                      <button
                        className="events-card__media-btn"
                        onClick={() => setSelectedImage(image)}
                        aria-label={`View full size image for ${ev.title}`}
                      >
                        <div className="upcoming-event__media">
                          <img src={image} alt={ev.title} loading="lazy" decoding="async" />
                          <div className="events-card__zoom-hint">Click to enlarge</div>
                        </div>
                      </button>
                    ) : (
                      <div className="upcoming-event__media">
                        <EventIcon name={ev.icon} />
                      </div>
                    )}
                    <div className="upcoming-event__body">
                      <p className="upcoming-event__full-date">
                        <time dateTime={ev.startDate}>{formatLongDate(ev.startDate, ev.endDate)}</time>
                      </p>
                      <h3 className="upcoming-event__title">{ev.title}</h3>
                      <p className="upcoming-event__description">{ev.description}</p>
                      {(ev.ticketed || ev.tbc) && (
                        <p className={`event-pill ${ev.ticketed ? 'event-pill--ticketed' : 'event-pill--tbc'}`}>
                          {ev.ticketed ? 'Tickets required' : 'Details to be confirmed'}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="events-column events-column--weekly">
            <h2 className="section-title">This week, every week</h2>
            <ul className="events-week">
              {weekdayOrder.map((day) => {
                const events = weeklyEvents[day]
                return (
                  <li key={day} className="events-day">
                    <h3 className="events-day__label">{weekdayLabels[day]}</h3>
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
                                <h4>{ev.title}</h4>
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
        </div>
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
