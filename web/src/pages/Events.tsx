import { weekdayOrder, weekdayLabels, weeklyEvents } from '../data/weeklyEvents'

export function Events() {
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
            const ev = weeklyEvents[day]
            return (
              <li key={day} className="events-day">
                <h2 className="events-day__label">{weekdayLabels[day]}</h2>
                {ev ? (
                  <article className="events-card">
                    <div className="events-card__media">
                      <img src={ev.image} alt="" loading="lazy" decoding="async" />
                    </div>
                    <div className="events-card__body">
                      <h3>{ev.title}</h3>
                      <p>{ev.description}</p>
                    </div>
                  </article>
                ) : (
                  <p className="muted events-day__empty">No regular event — see notices for specials.</p>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
