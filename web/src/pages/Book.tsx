import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../lib/apiBase'

type BusySlot = { start: string; end: string }

type AvailabilityResponse = {
  busy: BusySlot[]
  calendarConfigured: boolean
}

type BookingConfirmation = {
  reference: string
  name: string
  email: string
  phone: string
  address: string
  date: string
  slotType: 'day' | 'evening'
  startTime: string
  endTime: string
  eventType: string
  attendees: string
  exemption: string
  notes: string
}

const EXEMPTION_LABELS: Record<string, string> = {
  none: 'None – Regular Hire (£25)',
  adult_evening: 'Adult evening event (30+ bar users)',
  funeral: 'Funeral / Wake',
  charity: 'Charity Event',
}

const EMAIL_ADDRESS = 'merriottsocialvenue@gmail.com'

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = Number(h)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${display}:${m}${suffix}`
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

function getDayStatus(dayStr: string, busy: BusySlot[]) {
  const dayStart = new Date(`${dayStr}T00:00:00.000Z`).getTime()
  const splitPoint = dayStart + 18 * 60 * 60 * 1000 // 6pm
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

/* ── Success Screen ── */
function BookingSuccess({ booking, onReset }: { booking: BookingConfirmation; onReset: () => void }) {
  return (
    <div className="booking-success">
      <div className="booking-success__icon" aria-hidden="true">✓</div>
      <h2 className="booking-success__title">Booking Request Received</h2>
      <p className="booking-success__ref">
        Reference: <strong>{booking.reference}</strong>
      </p>
      <p className="booking-success__message">
        Thank you, {booking.name}. Your provisional booking request has been submitted successfully.
      </p>

      <div className="booking-success__details">
        <h3 className="booking-success__details-title">Your Booking Summary</h3>
        <dl className="booking-success__dl">
          <div className="booking-success__row">
            <dt>Date</dt>
            <dd>{formatDate(booking.date)}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Session</dt>
            <dd>{booking.slotType === 'day' ? 'Daytime' : 'Evening'}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Time</dt>
            <dd>{formatTime(booking.startTime)} – {formatTime(booking.endTime)}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Event Type</dt>
            <dd>{booking.eventType}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Attendees</dt>
            <dd>{booking.attendees}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Exemption</dt>
            <dd>{EXEMPTION_LABELS[booking.exemption] || booking.exemption}</dd>
          </div>
          {booking.notes && (
            <div className="booking-success__row">
              <dt>Notes</dt>
              <dd>{booking.notes}</dd>
            </div>
          )}
        </dl>

        <h3 className="booking-success__details-title" style={{ marginTop: '1.5rem' }}>Your Contact Details</h3>
        <dl className="booking-success__dl">
          <div className="booking-success__row">
            <dt>Name</dt>
            <dd>{booking.name}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Email</dt>
            <dd>{booking.email}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Phone</dt>
            <dd>{booking.phone}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Address</dt>
            <dd>{booking.address}</dd>
          </div>
        </dl>
      </div>

      <div className="booking-success__next-steps">
        <h3 className="booking-success__next-title">What happens next?</h3>
        <ol className="booking-success__steps-list">
          <li>A member of the Merriott Social Venue team will review your request.</li>
          <li>We will be in contact shortly to confirm availability, discuss any details, and arrange payment.</li>
          <li>If you need to get in touch sooner, please call the venue during opening hours.</li>
        </ol>
        <p className="booking-success__contact-hint">
          📞 You can reach us at the venue:
          <p>
            Telephone:{' '}
            <a href="tel:+447471593040">07471 593040</a>
          </p>
          <p>
            Email:{' '}
            <a href={`mailto:${EMAIL_ADDRESS}`}>{EMAIL_ADDRESS}</a>
          </p>
        </p>
      </div>

      <button type="button" className="btn btn--ghost btn--back" onClick={onReset}>
        ← Make another booking
      </button>
    </div>
  )
}

/* ── Main Page ── */
export function Book() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [busy, setBusy] = useState<BusySlot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarConfigured, setCalendarConfigured] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; type: 'day' | 'evening' } | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('22:00')
  const [eventType, setEventType] = useState('')
  const [attendees, setAttendees] = useState('')
  const [exemption, setExemption] = useState('none')
  const [declaration, setDeclaration] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null)

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
    setSubmitError(null)
    if (!selectedSlot) {
      setSubmitError('Please choose an available day or evening slot.')
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
          middleName,
          address,
          date: selectedSlot.date,
          slotType: selectedSlot.type,
          startTime,
          endTime,
          eventType,
          attendees: Number(attendees),
          exemption,
          declaration,
          notes,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; reference?: string; error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)

      // Scroll to top to show the success screen
      window.scrollTo({ top: 0, behavior: 'smooth' })

      setConfirmation({
        reference: body.reference || 'MSV-PENDING',
        name,
        email,
        phone,
        address,
        date: selectedSlot.date,
        slotType: selectedSlot.type,
        startTime,
        endTime,
        eventType,
        attendees,
        exemption,
        notes,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setConfirmation(null)
    setName('')
    setAddress('')
    setEmail('')
    setPhone('')
    setMiddleName('')
    setStartTime('18:00')
    setEndTime('22:00')
    setEventType('')
    setAttendees('')
    setExemption('none')
    setDeclaration(false)
    setNotes('')
    setSelectedSlot(null)
    void loadAvailability()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── If booking confirmed, show the success screen ──
  if (confirmation) {
    return (
      <section className="section">
        <div className="container container--narrow">
          <BookingSuccess booking={confirmation} onReset={handleReset} />
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="container container--narrow">
        <h1 className="page-title">Book the function room</h1>
        <p className="lede">
          Choose a date for a <strong>provisional</strong> hold. Our team will contact you to confirm
          details, deposit, and access times.
        </p>

        {loading ? (
          <div className="loader-container">
            <div className="spinner" role="status" aria-label="Loading" />
            <p className="muted">Checking availability calendar…</p>
          </div>
        ) : (
          <>
            {!calendarConfigured && (
              <p className="notice">
                Calendar integration is not configured on the server yet — all dates show as available.
              </p>
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
                <span className="cal-legend__box cal-legend__box--selected"></span> Your Selection
              </div>
            </div>

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
              {error && <p className="error-text">{error}</p>}
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
                          onClick={() => setSelectedSlot({ date: c.iso!, type: 'day' })}
                          aria-label={`Book Day slot on ${c.iso}`}
                        >
                          Day
                        </button>
                        <button
                          type="button"
                          className={`cal-slot cal-slot--evening${isEveningBusy ? ' cal-slot--busy' : ''}${eveSelected ? ' cal-slot--selected' : ''}`}
                          disabled={isEveningBusy || isPast}
                          onClick={() => setSelectedSlot({ date: c.iso!, type: 'evening' })}
                          aria-label={`Book Evening slot on ${c.iso}`}
                        >
                          Eve
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <form className="book-form" onSubmit={onSubmit}>
              {/* Honeypot field for anti-spam */}
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="middleName">Middle Name</label>
                <input
                  id="middleName"
                  type="text"
                  name="middleName"
                  tabIndex={-1}
                  autoComplete="off"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>

              <div className="book-form__section">
                <h2 className="section-title section-title--small">Booking Details</h2>
                <label className="field">
                  <span>Selected Slot</span>
                  <input
                    value={selectedSlot ? `${selectedSlot.date} (${selectedSlot.type === 'day' ? 'Day' : 'Evening'})` : ''}
                    readOnly
                    required
                    placeholder="Pick a slot in the calendar above"
                  />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Start Time</span>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                  </label>
                  <label className="field">
                    <span>End Time</span>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                  </label>
                </div>
                <p className="field-hint">Note: Bookings are typically in 4-hour blocks.</p>
                <label className="field">
                  <span>Type of Event</span>
                  <input value={eventType} onChange={(e) => setEventType(e.target.value)} required placeholder="e.g. Birthday Party, Meeting" />
                </label>
                <label className="field">
                  <span>Estimated Number of Attendees</span>
                  <input type="number" value={attendees} onChange={(e) => setAttendees(e.target.value)} required min="1" />
                </label>
              </div>

              <div className="book-form__section">
                <h2 className="section-title section-title--small">Hirer Details</h2>
                <label className="field">
                  <span>Full Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                </label>
                <label className="field">
                  <span>Address</span>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={2} />
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>Email Address</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </label>
                  <label className="field">
                    <span>Telephone Number</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      autoComplete="tel"
                    />
                  </label>
                </div>
              </div>

              <div className="book-form__section">
                <h2 className="section-title section-title--small">Exemptions & Notes</h2>
                <div className="field">
                  <span>Hire Charge Exemption</span>
                  <select value={exemption} onChange={(e) => setExemption(e.target.value)}>
                    <option value="none">None - Regular Hire (£25)</option>
                    <option value="adult_evening">Adult evening event (30+ bar users)</option>
                    <option value="funeral">Funeral / Wake</option>
                    <option value="charity">Charity Event</option>
                  </select>
                  <p className="field-hint">Cleaning deposit (£30) is required in all cases.</p>
                </div>
                <label className="field">
                  <span>Additional Notes</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any specific setup needs or requests?" />
                </label>
              </div>

              <div className="book-form__section book-form__section--terms">
                <h2 className="section-title section-title--small">Terms & Declaration</h2>
                <ul className="terms-list">
                  <li>A £30 cleaning deposit is required and will be refunded if the room is left clean and tidy.</li>
                  <li>The hirer is responsible for all attendees and their behaviour.</li>
                  <li>Any damage may result in loss of deposit and additional charges.</li>
                </ul>
                <label className="checkbox-field">
                  <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} required />
                  <span>I confirm the information is correct and agree to the terms above.</span>
                </label>
              </div>

              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Request provisional booking'}
              </button>
              {submitError && <p className="submit-message submit-message--error">{submitError}</p>}
            </form>
          </>
        )}
      </div>
    </section>
  )
}
