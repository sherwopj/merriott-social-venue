import { useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { SessionExpiredError, adminFetch } from '../lib/adminApi'
import { EXEMPTION_LABELS } from '../lib/bookingPricing'
import { formatPounds } from '../pages/admin/AdminBookings'
import type { Booking, BookingStatus } from '../pages/admin/AdminBookings'

function statusLabel(status: BookingStatus) {
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'confirmed') return 'Confirmed'
  return 'Provisional'
}

function penceToPoundsInput(pence: number) {
  return (pence / 100).toFixed(2)
}

export function BookingViewModal({
  booking,
  credential,
  onCredentialInvalid,
  onClose,
  onRefundSaved,
}: {
  booking: Booking
  credential: string
  onCredentialInvalid: () => void
  onClose: () => void
  onRefundSaved: (updated: Booking) => void
}) {
  const [feeRefunded, setFeeRefunded] = useState(penceToPoundsInput(booking.feeRefundedAmount))
  const [depositRefunded, setDepositRefunded] = useState(penceToPoundsInput(booking.depositRefundedAmount))
  const [barRefunded, setBarRefunded] = useState(penceToPoundsInput(booking.barSurchargeRefundedAmount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const canRecordRefund = booking.paymentMethod === 'online' && booking.paid && Boolean(booking.paymentIntentId)

  async function handleSaveRefund() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await adminFetch(apiUrl(`/api/admin/bookings/${booking.reference}/refund`), {
        method: 'PUT',
        headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeRefundedAmount: Math.round(parseFloat(feeRefunded || '0') * 100),
          depositRefundedAmount: Math.round(parseFloat(depositRefunded || '0') * 100),
          barSurchargeRefundedAmount: Math.round(parseFloat(barRefunded || '0') * 100),
        }),
      }, onCredentialInvalid)
      const data = await res.json()
      onRefundSaved(data.booking)
      setSaved(true)
    } catch (err) {
      if (err instanceof SessionExpiredError) return
      setError(err instanceof Error ? err.message : 'Could not save the refund record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="admin-modal__close" onClick={onClose} aria-label="Close">
          &times;
        </button>

        <h2 className="section-title section-title--small">Booking details</h2>

        <div className="admin-modal__section">
          <div className="admin-modal__row"><span>Reference</span><strong>{booking.reference}</strong></div>
          <div className="admin-modal__row"><span>Status</span><strong>{statusLabel(booking.status)}</strong></div>
          <div className="admin-modal__row"><span>Date</span><strong>{booking.date}</strong></div>
          <div className="admin-modal__row"><span>Time</span><strong>{booking.startTime}–{booking.endTime}</strong></div>
          <div className="admin-modal__row"><span>Event Type</span><strong>{booking.eventType || 'N/A'}</strong></div>
          <div className="admin-modal__row"><span>Attendees</span><strong>{booking.attendees || 'N/A'}</strong></div>
          <div className="admin-modal__row"><span>Exemption</span><strong>{EXEMPTION_LABELS[booking.exemption] || booking.exemption}</strong></div>
        </div>

        <div className="admin-modal__section">
          <div className="admin-modal__row"><span>Name</span><strong>{booking.name}</strong></div>
          <div className="admin-modal__row"><span>Email</span><strong>{booking.email}</strong></div>
          <div className="admin-modal__row"><span>Phone</span><strong>{booking.phone}</strong></div>
          {booking.address && <div className="admin-modal__row"><span>Address</span><strong>{booking.address}</strong></div>}
          {booking.notes && <div className="admin-modal__row"><span>Notes</span><strong>{booking.notes}</strong></div>}
        </div>

        <div className="admin-modal__section">
          <div className="admin-modal__row"><span>Hire fee</span><strong>{formatPounds(booking.feeAmount)}</strong></div>
          <div className="admin-modal__row"><span>Cleaning deposit</span><strong>{formatPounds(booking.depositAmount)}</strong></div>
          {booking.barSurchargeAmount > 0 && (
            <div className="admin-modal__row"><span>Bar surcharge</span><strong>{formatPounds(booking.barSurchargeAmount)}</strong></div>
          )}
          <div className="admin-modal__row"><span>Total</span><strong>{formatPounds(booking.total)}</strong></div>
          <div className="admin-modal__row">
            <span>Payment</span>
            <strong>{booking.paymentMethod === 'online' ? 'Online (card)' : 'In person'} — {booking.paid ? 'Paid' : 'Awaiting payment'}</strong>
          </div>
          {booking.paymentDashboardUrl && (
            <p className="field-hint">
              <a href={booking.paymentDashboardUrl} target="_blank" rel="noopener noreferrer">
                Open Stripe transaction ↗
              </a>
            </p>
          )}
        </div>

        {canRecordRefund && (
          <div className="admin-modal__section">
            <h3 className="section-title section-title--small">Record a refund</h3>
            <p className="field-hint">
              Refunds are issued manually in the Stripe Dashboard (use the link above) — record what was
              refunded here afterwards for the committee's records.
            </p>
            <div className="field-row">
              <label className="field">
                <span>Hire fee refunded (£)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={(booking.feeAmount / 100).toFixed(2)}
                  value={feeRefunded}
                  onChange={(e) => setFeeRefunded(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Deposit refunded (£)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={(booking.depositAmount / 100).toFixed(2)}
                  value={depositRefunded}
                  onChange={(e) => setDepositRefunded(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Bar fee refunded (£)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={(booking.barSurchargeAmount / 100).toFixed(2)}
                  value={barRefunded}
                  onChange={(e) => setBarRefunded(e.target.value)}
                />
              </label>
            </div>
            <button type="button" className="btn btn--primary" disabled={saving} onClick={handleSaveRefund}>
              {saving ? 'Saving…' : 'Save refund record'}
            </button>
            {saved && !error && <p className="submit-message">Refund record saved.</p>}
            {error && <p className="submit-message submit-message--error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
