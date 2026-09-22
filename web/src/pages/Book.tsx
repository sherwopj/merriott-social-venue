import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiUrl } from '../lib/apiBase'
import { EXEMPTION_LABELS, computeAmountBreakdown } from '../lib/bookingPricing'
import { SlotAvailabilityCalendar } from '../components/SlotAvailabilityCalendar'
import { InfoTip } from '../components/InfoTip'
import functionRoomHirePdf from '../assets/MSV_Function_Room_Hire_Policy_and_Form.pdf'

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
  barOpenTime: string
  barCloseTime: string
  paymentMethod: 'online' | 'in_person'
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

/* ── Success Screen ── */
function BookingSuccess({ booking, onReset }: { booking: BookingConfirmation; onReset: () => void }) {
  const amounts = computeAmountBreakdown(booking.exemption, booking.barOpenTime, booking.barCloseTime)

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

        <h3 className="booking-success__details-title" style={{ marginTop: '1.5rem' }}>Payment</h3>
        <dl className="booking-success__dl">
          <div className="booking-success__row">
            <dt>Hire fee</dt>
            <dd>{amounts.feeExempt ? 'Waived' : `£${amounts.feeAmount.toFixed(2)}`}</dd>
          </div>
          <div className="booking-success__row">
            <dt>Cleaning deposit</dt>
            <dd>£{amounts.depositAmount.toFixed(2)}</dd>
          </div>
          {amounts.barSurchargeAmount > 0 && (
            <div className="booking-success__row">
              <dt>Bar opening surcharge</dt>
              <dd>£{amounts.barSurchargeAmount.toFixed(2)}</dd>
            </div>
          )}
          <div className="booking-success__row booking-success__row--total">
            <dt>Total</dt>
            <dd>£{amounts.total.toFixed(2)}</dd>
          </div>
        </dl>
        <p className="field-hint">
          {booking.paymentMethod === 'online'
            ? 'Paid online by card.'
            : 'To be paid in person at the venue.'}
        </p>

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
        <div className="booking-success__contact-hint">
          📞 You can reach us at the venue:
          <p>
            Telephone:{' '}
            <a href="tel:+447471593040">07471 593040</a>
          </p>
          <p>
            Email:{' '}
            <a href={`mailto:${EMAIL_ADDRESS}`}>{EMAIL_ADDRESS}</a>
          </p>
        </div>
      </div>

      <button type="button" className="btn btn--ghost btn--back" onClick={onReset}>
        ← Make another booking
      </button>
    </div>
  )
}

/* ── Main Page ── */
export function Book() {
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; type: 'day' | 'evening' } | null>(null)
  const [slotMissing, setSlotMissing] = useState(false)
  const selectedSlotFieldRef = useRef<HTMLLabelElement>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('22:00')
  const [eventType, setEventType] = useState('')
  const [attendees, setAttendees] = useState('')
  const [barNeeded, setBarNeeded] = useState(false)
  const [barOpenTime, setBarOpenTime] = useState('')
  const [barCloseTime, setBarCloseTime] = useState('19:00')
  const [barTimeError, setBarTimeError] = useState<string | null>(null)
  const [exemption, setExemption] = useState('none')
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'in_person'>('online')
  const [declaration, setDeclaration] = useState(false)
  const [sendCopy, setSendCopy] = useState(true)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // After a redirect back from Stripe Checkout, look up what was paid and show the same
  // confirmation screen the in-person path shows immediately. Uses react-router's
  // useSearchParams rather than window.location.search, since with HashRouter the query
  // string lives inside the #fragment, not the browser's real query string.
  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!sessionId) return

    setCheckingPayment(true)
    fetch(apiUrl(`/api/bookings/checkout-session/${sessionId}`))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Request failed (${res.status})`))))
      .then((data) => {
        const booking = data.booking ?? {}
        setConfirmation({
          reference: booking.reference || 'MSV-PENDING',
          name: booking.name || '',
          email: booking.email || '',
          phone: booking.phone || '',
          address: booking.address || '',
          date: booking.date || '',
          slotType: booking.slotType === 'day' ? 'day' : 'evening',
          startTime: booking.startTime || '',
          endTime: booking.endTime || '',
          eventType: booking.eventType || '',
          attendees: booking.attendees || '',
          exemption: booking.exemption || 'none',
          notes: booking.notes || '',
          barOpenTime: booking.barOpenTime || '',
          barCloseTime: booking.barCloseTime || '',
          paymentMethod: 'online',
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
      .catch((err) => setSubmitError(err instanceof Error ? err.message : 'Could not confirm your payment.'))
      .finally(() => {
        setCheckingPayment(false)
        setSearchParams({}, { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const amounts = useMemo(
    () => computeAmountBreakdown(exemption, barNeeded ? barOpenTime : '', barNeeded ? barCloseTime : ''),
    [exemption, barNeeded, barOpenTime, barCloseTime],
  )
  const { feeExempt, barSurchargeHours, total: amountDue } = amounts

  // Keep the bar-open time range sane as either field changes.
  useEffect(() => {
    if (!barNeeded) {
      setBarTimeError(null)
      return
    }
    setBarTimeError(barCloseTime <= barOpenTime ? 'Bar closing time must be later than the opening time.' : null)
  }, [barNeeded, barOpenTime, barCloseTime])

  function selectSlot(date: string, type: 'day' | 'evening', startT: string, endT: string) {
    setSelectedSlot({ date, type })
    setStartTime(startT)
    setEndTime(endT)
    setSlotMissing(false)
    selectedSlotFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!selectedSlot) {
      setSlotMissing(true)
      setSubmitError('Please choose an available day or evening slot.')
      selectedSlotFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (barNeeded && barTimeError) {
      setSubmitError(barTimeError)
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
          paymentMethod,
          declaration,
          sendCopyToHirer: sendCopy,
          notes,
          barOpenTime: barNeeded ? barOpenTime : '',
          barCloseTime: barNeeded ? barCloseTime : '',
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; reference?: string; error?: string }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)

      if (body.url) {
        // Pay-online path: hand off to Stripe Checkout. The confirmation screen is shown
        // when the hirer is redirected back to this page with ?session_id=... (see the
        // useEffect above), not here.
        window.location.href = body.url
        return
      }

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
        barOpenTime: barNeeded ? barOpenTime : '',
        barCloseTime: barNeeded ? barCloseTime : '',
        paymentMethod: 'in_person',
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
    setBarNeeded(false)
    setBarOpenTime('')
    setBarCloseTime('19:00')
    setBarTimeError(null)
    setExemption('none')
    setDeclaration(false)
    setNotes('')
    setSelectedSlot(null)
    setCalendarRefreshKey((k) => k + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Returning from Stripe Checkout: briefly confirming before showing the success screen ──
  if (checkingPayment) {
    return (
      <section className="section">
        <div className="container container--narrow">
          <div className="loader-container">
            <p>Confirming your payment…</p>
          </div>
        </div>
      </section>
    )
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

        <div className="booking-policy-links">
          <a
            className="btn btn--ghost"
            href={functionRoomHirePdf}
            target="_blank"
            rel="noopener noreferrer"
          >
            View hire policy and form PDF
          </a>
        </div>

        <SlotAvailabilityCalendar key={calendarRefreshKey} selectedSlot={selectedSlot} onSelectSlot={selectSlot} />

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
                <label className="field" ref={selectedSlotFieldRef}>
                  <span>
                    Selected Slot
                    <InfoTip label="Session timing details">
                      Sessions are generally booked in 4-hour blocks. The room is usually hired as a morning,
                      afternoon or evening session.
                    </InfoTip>
                  </span>
                  <input
                    value={selectedSlot ? `${selectedSlot.date} (${selectedSlot.type === 'day' ? 'Day' : 'Evening'})` : ''}
                    readOnly
                    required
                    aria-invalid={slotMissing}
                    className={slotMissing ? 'input-invalid' : undefined}
                    placeholder="Pick a slot in the calendar above"
                  />
                  {slotMissing && <p className="error-text">Please choose a day or evening slot in the calendar above.</p>}
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
                <p className="field-hint">Standard room hire is a 4-hour session, with a £25 hire fee and £30 cleaning deposit payable when booking.</p>
                <label className="field">
                  <span>Type of Event</span>
                  <input value={eventType} onChange={(e) => setEventType(e.target.value)} required placeholder="e.g. Birthday Party, Meeting" />
                </label>
                <label className="field">
                  <span>
                    Estimated Number of Adults
                    <InfoTip label="Adult attendance and fee refund">
                      For large evening events, the fee may be refunded after the event if confirmed adult attendance
                      reaches 15+ and the bar is open, as set out in the hire policy.
                    </InfoTip>
                  </span>
                  <input type="number" value={attendees} onChange={(e) => setAttendees(e.target.value)} required min="1" />
                </label>
                <div className="field">
                  <span>
                    Bar Opening
                    <InfoTip label="Bar opening charges">
                      The bar normally opens at 7pm. Opening it earlier is charged at £15 per hour (or part hour)
                      for the time between your requested start time and 7pm — whichever is earlier out of your
                      closing time and 7pm. Payable upfront along with the hire fee and deposit. As with the hire
                      fee, the committee may refund some or all of this at their discretion for larger events.
                    </InfoTip>
                  </span>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={barNeeded}
                      onChange={(e) => {
                        setBarNeeded(e.target.checked)
                        if (!e.target.checked) {
                          setBarOpenTime('')
                          setBarCloseTime('19:00')
                        } else if (!barOpenTime) {
                          setBarOpenTime('16:00')
                        }
                      }}
                    />
                    <span>I need the bar open before 7pm</span>
                  </label>
                  {barNeeded && (
                    <>
                      <div className="field-row">
                        <label className="field">
                          <span>Bar Start Time</span>
                          <input
                            type="time"
                            value={barOpenTime}
                            onChange={(e) => setBarOpenTime(e.target.value)}
                            aria-label="Requested bar opening time"
                          />
                        </label>
                        <label className="field">
                          <span>Bar End Time</span>
                          <input
                            type="time"
                            value={barCloseTime}
                            onChange={(e) => setBarCloseTime(e.target.value)}
                            aria-label="Requested bar closing time"
                          />
                        </label>
                      </div>
                      {barTimeError ? (
                        <p className="error-text">{barTimeError}</p>
                      ) : (
                        barSurchargeHours > 0 && (
                          <p className="field-hint">
                            {barSurchargeHours} hour{barSurchargeHours === 1 ? '' : 's'} before the normal 7pm opening
                            — £{(barSurchargeHours * 15).toFixed(2)} bar surcharge added below. May be refunded at
                            committee discretion for larger events.
                          </p>
                        )
                      )}
                    </>
                  )}
                </div>
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
                  <span>
                    Hire Charge Status
                    <InfoTip label="Hire charge policy">
                      Standard hire is £25. Wakes and registered charity events are fee-free. Large evening events with
                      the bar open may be eligible for a refund of the £25 fee after the event if confirmed adult
                      attendance is 15+.
                    </InfoTip>
                  </span>
                  <select value={exemption} onChange={(e) => setExemption(e.target.value)}>
                    <option value="none">None – Standard hire (£25)</option>
                    <option value="large_evening">Large evening event (15+ adults, bar open)</option>
                    <option value="funeral">Funeral / wake</option>
                    <option value="charity">Registered charity event</option>
                  </select>
                  <p className="field-hint">The £30 cleaning deposit still applies in all cases, and committee discretion can waive it in exceptional circumstances.</p>
                </div>
                <label className="field">
                  <span>Additional Notes</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any specific setup needs or requests?" />
                </label>
              </div>

              <div className="book-form__section">
                <h2 className="section-title section-title--small">Payment</h2>
                <p className="field-hint">
                  Amount due now: <strong>£{amountDue.toFixed(2)}</strong>
                  {' '}({feeExempt ? 'fee waived, ' : '£25 hire fee + '}£30 cleaning deposit
                  {barSurchargeHours > 0 ? ` + £${(barSurchargeHours * 15).toFixed(2)} bar surcharge` : ''})
                </p>
                <div className="field">
                  <span>How will you pay?</span>
                  <label className="checkbox-field">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'online'}
                      onChange={() => setPaymentMethod('online')}
                    />
                    <span>Pay online now by card</span>
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={paymentMethod === 'in_person'}
                      onChange={() => setPaymentMethod('in_person')}
                    />
                    <span>Pay in person at the venue</span>
                  </label>
                </div>
              </div>

              <div className="book-form__section book-form__section--terms">
                <h2 className="section-title section-title--small">Terms & Declaration</h2>
                <ul className="terms-list">
                  <li>£25 room hire fee and a £30 cleaning deposit are payable when booking. The deposit is refundable if the room and kitchen are left clean, tidy, and undamaged.</li>
                  <li>Wakes and registered charity events are fee-free; large adult evening events with the bar open may be eligible for a fee refund after the event if attendance is 15+.</li>
                  <li>The hirer is responsible for guests’ conduct, room capacity, and keeping exits clear at all times.</li>
                  <li>No outside alcohol, no smoking indoors, no candles, confetti, or fireworks without prior committee agreement, and nothing may be stuck, taped, or pinned to the walls.</li>
                  <li>Furniture must be returned to its normal layout by the end of the session, and the cleaning deposit covers both the function room and kitchen.</li>
                </ul>
                <label className="checkbox-field">
                  <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} required />
                  <span>I confirm the information is correct and agree to the terms above.</span>
                </label>
                <label className="checkbox-field">
                  <input type="checkbox" checked={sendCopy} onChange={(e) => setSendCopy(e.target.checked)} />
                  <span>Send me a duplicate provisional booking email</span>
                </label>
              </div>

              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting
                  ? 'Sending…'
                  : paymentMethod === 'online'
                    ? 'Agree & continue to payment'
                    : 'Agree & request booking'}
              </button>
              <p className="field-hint">
                By submitting this request, you agree to our{' '}
                <a href={functionRoomHirePdf} target="_blank" rel="noopener noreferrer">
                  Booking Policy
                </a>
                .
              </p>
              {submitError && <p className="submit-message submit-message--error">{submitError}</p>}
            </form>
      </div>
    </section>
  )
}
