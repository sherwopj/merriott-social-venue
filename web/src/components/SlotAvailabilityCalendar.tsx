import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { addMonths, daysInMonth, startOfMonth, toISODate } from '../lib/dateGrid'

type BusySlot = { start: string; end: string }
export type SelectedSlot = { date: string; type: 'day' | 'evening' } | null

function getDayStatus(dayStr: string, busy: BusySlot[]) {
  const dayStart = new Date(`${dayStr}T00:00:00`).getTime()
  const splitPoint = dayStart + 18 * 60 * 60 * 1000 // 6pm local time
  const dayEnd = dayStart + 24 * 60 * 60 * 1000

  let isDayBusy = false
  let isEveningBusy = false

  for (const b of busy) {
    const s = new Date(b.start).getTime()
    const e = new Date(b.end).getTime()
    if (s < splitPoint && e > dayStart) isDayBusy = true
    if (s < dayEnd && e > splitPoint) isEveningBusy = true
  }

  return { isDayBusy, isEveningBusy }
}

// Day/Evening slots and their fixed times match the public booking form exactly, so
// availability reads the same way whether you're booking the room or scheduling an event.
export function SlotAvailabilityCalendar({
  room,
  selectedSlot,
  onSelectSlot,
}: {
  room?: string
  selectedSlot: SelectedSlot
  onSelectSlot: (date: string, type: 'day' | 'evening', startTime: string, endTime: string) => void
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
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
      if (room) u.searchParams.set('room', room)
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
    <div className="book-calendar">
      {!calendarConfigured && (
        <p className="notice">Calendar integration isn't configured for this room yet — all dates show as available.</p>
      )}

      <div className="cal-legend">
        <div className="cal-legend__item">
          <span className="cal-legend__box cal-legend__box--available-day"></span> Day Available
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__box cal-legend__box--available-eve"></span> Eve Available
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__box cal-legend__box--busy"></span> Booked
        </div>
        <div className="cal-legend__item">
          <span className="cal-legend__box cal-legend__box--selected"></span> Selected
        </div>
      </div>

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
        <div className="cal-grid" role="grid" aria-label="Select a date">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="cal-grid__head" role="columnheader">
              {d}
            </div>
          ))}
          {cells.map((c, i) => {
            if (c.kind === 'empty') return <div key={`e-${i}`} className="cal-grid__cell cal-grid__cell--empty" />
            const { isDayBusy, isEveningBusy } = getDayStatus(c.iso, busy)
            const isPast = c.iso <= todayStr

            const daySelected = selectedSlot?.date === c.iso && selectedSlot?.type === 'day'
            const eveSelected = selectedSlot?.date === c.iso && selectedSlot?.type === 'evening'

            return (
              <div key={c.iso} className="cal-grid__cell cal-grid__day-container">
                <span className="cal-grid__day-num">{c.day}</span>
                <div className="cal-grid__slots">
                  <button
                    type="button"
                    className={`cal-slot cal-slot--day${isDayBusy ? ' cal-slot--busy' : ''}${daySelected ? ' cal-slot--selected' : ''}`}
                    disabled={isDayBusy || isPast}
                    onClick={() => onSelectSlot(c.iso, 'day', '12:00', '18:00')}
                    aria-label={`Day slot on ${c.iso}`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    className={`cal-slot cal-slot--evening${isEveningBusy ? ' cal-slot--busy' : ''}${eveSelected ? ' cal-slot--selected' : ''}`}
                    disabled={isEveningBusy || isPast}
                    onClick={() => onSelectSlot(c.iso, 'evening', '18:00', '22:00')}
                    aria-label={`Evening slot on ${c.iso}`}
                  >
                    Eve
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
