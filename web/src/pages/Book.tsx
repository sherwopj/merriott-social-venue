import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../lib/apiBase'

type BusySlot = { start: string; end: string }

type AvailabilityResponse = {
  busy: BusySlot[]
  calendarConfigured: boolean
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function dayHasBusy(dayStr: string, busy: BusySlot[]) {
  const dayStart = new Date(`${dayStr}T00:00:00.000Z`).getTime()
  const dayEnd = dayStart + 86400000
  return busy.some((b) => {
    const s = new Date(b.start).getTime()
    const e = new Date(b.end).getTime()
    return s < dayEnd && e > dayStart
  })
}

export function Book() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarConfigured, setCalendarConfigured] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  const range = useMemo(() => {
    const start = startOfMonth(cursor)
    const end = addMonths(start, 1)
    return { start: toISODate(start), end: toISODate(end) }
  }, [cursor])

  const loadAvailability = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pathOrAbsolute = apiUrl('/api/calendar/availability')
      const u = pathOrAbsolute.startsWith('http')
        ? new URL(pathOrAbsolute)
        : new URL(pathOrAbsolute, window.location.origin)
      u.searchParams.set('start', range.start)
      u.searchParams.set('end', range.end)
      const res = await fetch(u.toString())
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = (await res.json()) as AvailabilityResponse
      setBusy(data.busy)
      setCalendarConfigured(data.calendarConfigured)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load availability')
      setBusy([])
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end])

  useEffect(() => {
    void loadAvailability()
  }, [loadAvailability])

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitMessage(null)
    if (!selectedDate) {
      setSubmitMessage('Please choose an available date.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(apiUrl('/api/bookings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          date: selectedDate,
          notes,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; reference?: string; error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
      setSubmitMessage(
        body.reference
          ? `Thanks — your request is logged (reference ${body.reference}). We will be in touch to confirm.`
          : 'Thanks — your request was received. We will be in touch to confirm.',
      )
      setName('')
      setEmail('')
      setPhone('')
      setNotes('')
      setSelectedDate(null)
      void loadAvailability()
    } catch (err) {
      setSubmitMessage(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="section">
      <div className="container container--narrow">
        <h1 className="page-title">Book the function room</h1>
        <p className="lede">
          Choose a date for a <strong>provisional</strong> hold. Our team will contact you to confirm
          details, deposit, and access times.
        </p>

        {!calendarConfigured && (
          <p className="notice">
            Calendar integration is not configured on the server yet — all dates show as available.
            The venue should set Google Calendar credentials on the API service.
          </p>
        )}

        <div className="book-calendar">
          <div className="book-calendar__toolbar">
            <button type="button" className="btn btn--ghost" onClick={() => setCursor(addMonths(cursor, -1))}>
              Previous
            </button>
            <h2 className="book-calendar__title">
              {cursor.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
            </h2>
            <button type="button" className="btn btn--ghost" onClick={() => setCursor(addMonths(cursor, 1))}>
              Next
            </button>
          </div>
          {loading && <p className="muted">Loading availability…</p>}
          {error && <p className="error-text">{error}</p>}
          <div className="cal-grid" role="grid" aria-label="Select a date">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="cal-grid__head" role="columnheader">
                {d}
              </div>
            ))}
            {cells.map((c, i) => {
              if (c.kind === 'empty') return <div key={`e-${i}`} className="cal-grid__cell cal-grid__cell--empty" />
              const blocked = dayHasBusy(c.iso, busy)
              const isPast = c.iso < todayStr
              const disabled = blocked || isPast
              const selected = selectedDate === c.iso
              return (
                <button
                  key={c.iso}
                  type="button"
                  role="gridcell"
                  className={`cal-grid__cell cal-grid__day${disabled ? ' cal-grid__day--disabled' : ''}${selected ? ' cal-grid__day--selected' : ''}${blocked ? ' cal-grid__day--busy' : ''}`}
                  disabled={disabled}
                  onClick={() => setSelectedDate(c.iso)}
                >
                  <span className="cal-grid__num">{c.day}</span>
                  {blocked ? <span className="cal-grid__badge">Busy</span> : null}
                </button>
              )
            })}
          </div>
        </div>

        <form className="book-form" onSubmit={onSubmit}>
          <h2 className="section-title section-title--small">Your details</h2>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />
          </label>
          <label className="field">
            <span>Selected date</span>
            <input value={selectedDate ?? ''} readOnly required placeholder="Pick a day above" />
          </label>
          <label className="field">
            <span>Notes (occasion, approximate guests, setup needs)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </label>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Request provisional booking'}
          </button>
          {submitMessage && <p className="submit-message">{submitMessage}</p>}
        </form>
      </div>
    </section>
  )
}
