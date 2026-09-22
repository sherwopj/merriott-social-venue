import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { addMonths, daysInMonth, startOfMonth, toISODate } from '../lib/dateGrid'

type BusySlot = { start: string; end: string }

function isDayBusy(dayStr: string, busy: BusySlot[]) {
  const dayStart = new Date(`${dayStr}T00:00:00`).getTime()
  const dayEnd = dayStart + 24 * 60 * 60 * 1000
  return busy.some((b) => new Date(b.start).getTime() < dayEnd && new Date(b.end).getTime() > dayStart)
}

export function EventAvailabilityCalendar({
  room,
  selectedDate,
  onSelectDate,
}: {
  room: string
  selectedDate: string
  onSelectDate: (iso: string) => void
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(selectedDate ? new Date(`${selectedDate}T12:00:00`) : new Date()))
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarConfigured, setCalendarConfigured] = useState(true)

  const range = useMemo(() => {
    const start = startOfMonth(cursor)
    const end = addMonths(start, 1)
    return { start: toISODate(start), end: toISODate(end) }
  }, [cursor])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const u = new URL(apiUrl('/api/calendar/availability'), window.location.origin)
      u.searchParams.set('start', range.start)
      u.searchParams.set('end', range.end)
      u.searchParams.set('room', room)
      const res = await fetch(u.toString())
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = (await res.json()) as { busy: BusySlot[]; calendarConfigured: boolean }
      setBusy(data.busy)
      setCalendarConfigured(data.calendarConfigured)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load availability')
      setBusy([])
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end, room])

  useEffect(() => {
    void load()
  }, [load])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const totalDays = daysInMonth(year, month)
  const todayStr = toISODate(new Date())

  const cells = useMemo(() => {
    const pad = (firstDow + 6) % 7
    const list: ({ kind: 'empty' } | { kind: 'day'; day: number; iso: string })[] = []
    for (let i = 0; i < pad; i++) list.push({ kind: 'empty' })
    for (let d = 1; d <= totalDays; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      list.push({ kind: 'day', day: d, iso })
    }
    return list
  }, [firstDow, totalDays, year, month])

  return (
    <div className="book-calendar book-calendar--compact">
      {!calendarConfigured && (
        <p className="notice">Calendar integration is not configured for this room yet.</p>
      )}
      <div className="book-calendar__toolbar">
        <button type="button" className="btn btn--ghost" onClick={() => setCursor(addMonths(cursor, -1))}>
          Previous
        </button>
        <h2 className="book-calendar__title">{cursor.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h2>
        <button type="button" className="btn btn--ghost" onClick={() => setCursor(addMonths(cursor, 1))}>
          Next
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="field-hint">Loading availability…</p>
      ) : (
        <div className="cal-grid cal-grid--compact" role="grid" aria-label="Check availability and pick a date">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="cal-grid__head" role="columnheader">
              {d}
            </div>
          ))}
          {cells.map((c, i) => {
            if (c.kind === 'empty') return <div key={`e-${i}`} className="cal-grid__cell cal-grid__cell--empty" />
            const busyDay = isDayBusy(c.iso, busy)
            const isPast = c.iso < todayStr
            const isSelected = c.iso === selectedDate

            return (
              <button
                type="button"
                key={c.iso}
                className={`cal-day${busyDay ? ' cal-day--busy' : ' cal-day--free'}${isSelected ? ' cal-day--selected' : ''}`}
                disabled={isPast}
                onClick={() => onSelectDate(c.iso)}
                aria-label={`${busyDay ? 'Booked' : 'Available'}: ${c.iso}`}
              >
                {c.day}
              </button>
            )
          })}
        </div>
      )}
      <div className="cal-legend">
        <div className="cal-legend__item">
          <span className="cal-legend__box cal-legend__box--available-day"></span> Available
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__box cal-legend__box--busy"></span> Booked
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__box cal-legend__box--selected"></span> Selected
        </div>
      </div>
    </div>
  )
}
