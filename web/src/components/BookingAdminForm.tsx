import { type FormEvent, useEffect, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { SessionExpiredError, adminFetch } from '../lib/adminApi'
import { EXEMPTION_LABELS, computeAmountBreakdown } from '../lib/bookingPricing'
import { SlotAvailabilityCalendar } from './SlotAvailabilityCalendar'
import { InfoTip } from './InfoTip'
import type { Booking } from '../pages/admin/AdminBookings'

export function BookingAdminForm({
  credential,
  existingBooking,
  onSaved,
  onCancel,
  onCredentialInvalid,
}: {
  credential: string
  existingBooking?: Booking
  onSaved: () => void
  onCancel: () => void
  onCredentialInvalid: () => void
}) {
  const isEditing = Boolean(existingBooking)

  const [name, setName] = useState(existingBooking?.name ?? '')
  const [email, setEmail] = useState(existingBooking?.email ?? '')
  const [phone, setPhone] = useState(existingBooking?.phone ?? '')
  const [address, setAddress] = useState(existingBooking?.address ?? '')
  const [date, setDate] = useState(existingBooking?.date ?? '')
  const [startTime, setStartTime] = useState(existingBooking?.startTime ?? '18:00')
  const [endTime, setEndTime] = useState(existingBooking?.endTime ?? '22:00')
  const [eventType, setEventType] = useState(existingBooking?.eventType ?? '')
  const [attendees, setAttendees] = useState(existingBooking?.attendees ?? '')
  const [exemption, setExemption] = useState(existingBooking?.exemption ?? 'none')
  const [barNeeded, setBarNeeded] = useState(Boolean(existingBooking?.barOpenTime))
  const [barOpenTime, setBarOpenTime] = useState(existingBooking?.barOpenTime ?? '')
  const [barCloseTime, setBarCloseTime] = useState(existingBooking?.barCloseTime || '19:00')
  const [barTimeError, setBarTimeError] = useState<string | null>(null)
  const [notes, setNotes] = useState(existingBooking?.notes ?? '')
  const [paid, setPaid] = useState(existingBooking?.paid ?? false)
  const [confirmed, setConfirmed] = useState(existingBooking?.status === 'confirmed')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amounts = computeAmountBreakdown(exemption, barNeeded ? barOpenTime : '', barNeeded ? barCloseTime : '')

  useEffect(() => {
    if (!barNeeded) {
      setBarTimeError(null)
      return
    }
    setBarTimeError(barCloseTime <= barOpenTime ? 'Bar closing time must be later than the opening time.' : null)
  }, [barNeeded, barOpenTime, barCloseTime])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (barNeeded && barTimeError) {
      setError(barTimeError)
      return
    }
    setSubmitting(true)
    try {
      const url = isEditing
        ? apiUrl(`/api/admin/bookings/${existingBooking!.reference}`)
        : apiUrl('/api/admin/bookings')

      const body: Record<string, unknown> = { name, email, phone, address, date, startTime, endTime, eventType, attendees, notes, confirmed }
      if (!isEditing) {
        // Exemption and bar-opening times are only ever set at creation — editing an existing
        // booking can't change them, since they determine the price.
        body.exemption = exemption
        body.barOpenTime = barNeeded ? barOpenTime : ''
        body.barCloseTime = barNeeded ? barCloseTime : ''
        // Admin-entered bookings are always recorded as taken in person by a committee
        // member — there's no Stripe Checkout step here, unlike the public booking form.
        body.paymentMethod = 'in_person'
        body.paid = paid
      }

      await adminFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }, onCredentialInvalid)
      onSaved()
    } catch (err) {
      if (err instanceof SessionExpiredError) return
      setError(err instanceof Error ? err.message : 'Could not save the booking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="book-form" onSubmit={onSubmit}>
      <div className="book-form__section">
        <h2 className="section-title section-title--small">Booking Details</h2>

        <div className="field">
          <span>Check availability &amp; pick a date/slot</span>
          <SlotAvailabilityCalendar
            room="MSV Function Room"
            selectedSlot={date ? { date, type: startTime === '12:00' ? 'day' : 'evening' } : null}
            onSelectSlot={(d, _type, startT, endT) => {
              setDate(d)
              setStartTime(startT)
              setEndTime(endT)
            }}
          />
        </div>

        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>Start Time</span>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="field">
            <span>End Time</span>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <p className="field-hint">Standard room hire is a 4-hour session, with a £25 hire fee and £30 cleaning deposit payable when booking.</p>

        <label className="field">
          <span>Type of Event</span>
          <input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="e.g. Birthday Party, Meeting" />
        </label>
        <label className="field">
          <span>Estimated Number of Adults</span>
          <input type="number" min="1" value={attendees} onChange={(e) => setAttendees(e.target.value)} />
        </label>

        {isEditing ? (
          <div className="field">
            <span>Bar Opening</span>
            <p className="field-hint">
              {existingBooking?.barOpenTime
                ? `Requested for ${existingBooking.barOpenTime}–${existingBooking.barCloseTime || '19:00'} — locked, since it determines the price.`
                : 'Not requested.'}
            </p>
          </div>
        ) : (
          <div className="field">
            <span>
              Bar Opening
              <InfoTip label="Bar opening charges">
                The bar normally opens at 7pm. Opening it earlier is charged at £15 per hour (or part hour)
                for the time between the start time and 7pm — whichever is earlier out of the closing time
                and 7pm. As with the hire fee, the committee may refund some or all of this at their
                discretion for larger events.
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
              <span>Bar open before 7pm</span>
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
                  amounts.barSurchargeAmount > 0 && (
                    <p className="field-hint">
                      {amounts.barSurchargeHours} hour{amounts.barSurchargeHours === 1 ? '' : 's'} before the
                      normal 7pm opening — £{amounts.barSurchargeAmount.toFixed(2)} bar surcharge. May be
                      refunded at committee discretion for larger events.
                    </p>
                  )
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="book-form__section">
        <h2 className="section-title section-title--small">Hirer Details</h2>
        <label className="field">
          <span>Full Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Address</span>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Email Address</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Telephone Number</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
        </div>
      </div>

      <div className="book-form__section">
        <h2 className="section-title section-title--small">Exemptions &amp; Notes</h2>
        {isEditing ? (
          <div className="field">
            <span>Hire Charge Status</span>
            <p className="field-hint">
              {EXEMPTION_LABELS[exemption] || exemption} — locked, since it determines the price. Cancel and create a
              new booking instead if this needs to change.
            </p>
          </div>
        ) : (
          <label className="field">
            <span>Hire Charge Status</span>
            <select value={exemption} onChange={(e) => setExemption(e.target.value)}>
              <option value="none">None – Standard hire (£25)</option>
              <option value="large_evening">Large evening event (15+ adults, bar open)</option>
              <option value="funeral">Funeral / wake</option>
              <option value="charity">Registered charity event</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>Additional Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>
      </div>

      {!isEditing && (
        <div className="book-form__section">
          <h2 className="section-title section-title--small">Payment</h2>
          <p className="field-hint">
            Amount due: <strong>£{amounts.total.toFixed(2)}</strong>
            {' '}({amounts.feeExempt ? 'fee waived, ' : '£25 hire fee + '}£30 cleaning deposit
            {amounts.barSurchargeAmount > 0 ? ` + £${amounts.barSurchargeAmount.toFixed(2)} bar surcharge` : ''})
          </p>
          <label className="checkbox-field">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            <span>Payment has already been taken</span>
          </label>
        </div>
      )}

      <div className="book-form__section">
        <h2 className="section-title section-title--small">Status</h2>
        <label className="checkbox-field">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>Confirmed — contacted the hirer and confirmed the booking</span>
        </label>
      </div>

      <div className="admin-form-actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create booking'}
        </button>
        <button type="button" className="link-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
      {error && <p className="submit-message submit-message--error">{error}</p>}
    </form>
  )
}
