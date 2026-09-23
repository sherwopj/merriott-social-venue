import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { apiUrl } from '../../lib/apiBase'
import { SessionExpiredError, adminFetch } from '../../lib/adminApi'
import { EXEMPTION_LABELS } from '../../lib/bookingPricing'
import { BookingAdminForm } from '../../components/BookingAdminForm'
import { BookingViewModal } from '../../components/BookingViewModal'
import type { AdminOutletContext } from './AdminLayout'

export type BookingStatus = 'provisional' | 'confirmed' | 'cancelled'

export type Booking = {
  reference: string
  status: BookingStatus
  paymentMethod: 'online' | 'in_person'
  paid: boolean
  date: string
  startTime: string
  endTime: string
  eventType: string
  attendees: string
  exemption: string
  barOpenTime: string
  barCloseTime: string
  notes: string
  name: string
  email: string
  phone: string
  address: string
  feeAmount: number
  depositAmount: number
  barSurchargeAmount: number
  total: number
  calendarEventId?: string
  calendarEventLink?: string
  paymentIntentId?: string
  paymentDashboardUrl?: string
  createdBy: string
  lastUpdatedBy?: string
  feeRefundedAmount: number
  depositRefundedAmount: number
  barSurchargeRefundedAmount: number
}

type BookingsResponse = {
  sheetConfigured: boolean
  bookings: Booking[]
}

// Booking amounts are stored on the sheet in pence (matching Stripe's convention).
export function formatPounds(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

function statusLabel(status: BookingStatus) {
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'confirmed') return 'Confirmed'
  return 'Provisional'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function refundedTotal(b: Booking) {
  return b.feeRefundedAmount + b.depositRefundedAmount + b.barSurchargeRefundedAmount
}

export function AdminBookings() {
  const { credential, onCredentialInvalid } = useOutletContext<AdminOutletContext>()
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [sheetConfigured, setSheetConfigured] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingReference, setEditingReference] = useState<string | null>(null)
  const [viewingReference, setViewingReference] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actioningReference, setActioningReference] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    return fetch(apiUrl('/api/admin/bookings'), { headers: { Authorization: `Bearer ${credential}` } })
      .then((res) => {
        if (res.status === 401) {
          onCredentialInvalid()
          return Promise.reject(new Error('Session expired'))
        }
        return res.ok ? (res.json() as Promise<BookingsResponse>) : Promise.reject(new Error(`Request failed (${res.status})`))
      })
      .then((data) => {
        setSheetConfigured(data.sheetConfigured)
        setBookings([...data.bookings].sort((a, b) => a.date.localeCompare(b.date)))
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load bookings'))
  }, [credential, onCredentialInvalid])

  useEffect(() => {
    void load()
  }, [load])

  async function handleConfirm(booking: Booking) {
    setActioningReference(booking.reference)
    setActionError(null)
    try {
      await adminFetch(apiUrl(`/api/admin/bookings/${booking.reference}/confirm`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${credential}` },
      }, onCredentialInvalid)
      await load()
    } catch (err) {
      if (err instanceof SessionExpiredError) return
      setActionError(err instanceof Error ? err.message : 'Could not confirm the booking')
    } finally {
      setActioningReference(null)
    }
  }

  async function handleCancel(booking: Booking) {
    if (!window.confirm(`Cancel the booking for ${booking.name} on ${booking.date}? This deletes the calendar event and emails the hirer — it can't be undone.`)) {
      return
    }
    setActioningReference(booking.reference)
    setActionError(null)
    try {
      await adminFetch(apiUrl(`/api/admin/bookings/${booking.reference}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${credential}` },
      }, onCredentialInvalid)
      await load()
    } catch (err) {
      if (err instanceof SessionExpiredError) return
      setActionError(err instanceof Error ? err.message : 'Could not cancel the booking')
    } finally {
      setActioningReference(null)
    }
  }

  if (loadError) return <p className="notice">Could not load bookings: {loadError}</p>
  if (!sheetConfigured) return <p className="notice">Bookings sheet isn't configured on the server yet.</p>
  if (!bookings) return <p className="field-hint">Loading…</p>

  const editingBooking = bookings.find((b) => b.reference === editingReference) ?? null
  const viewingBooking = bookings.find((b) => b.reference === viewingReference) ?? null
  const today = todayIso()

  return (
    <div className="admin-tool">
      {actionError && <p className="submit-message submit-message--error">{actionError}</p>}

      {showCreate ? (
        <>
          <h2 className="section-title section-title--small">Add booking</h2>
          <BookingAdminForm
            credential={credential}
            onCredentialInvalid={onCredentialInvalid}
            onCancel={() => setShowCreate(false)}
            onSaved={() => {
              setShowCreate(false)
              void load()
            }}
          />
        </>
      ) : editingBooking ? (
        <>
          <h2 className="section-title section-title--small">Edit booking</h2>
          <BookingAdminForm
            credential={credential}
            existingBooking={editingBooking}
            onCredentialInvalid={onCredentialInvalid}
            onCancel={() => setEditingReference(null)}
            onSaved={() => {
              setEditingReference(null)
              void load()
            }}
          />
        </>
      ) : (
        <>
          <div className="admin-tool__header">
            <h2 className="section-title section-title--small">Manage bookings</h2>
            <button type="button" className="btn btn--primary" onClick={() => setShowCreate(true)}>
              + Add booking
            </button>
          </div>

          {bookings.length === 0 ? (
            <p className="field-hint">No bookings yet.</p>
          ) : (
            <ul className="manage-events-list">
              {bookings.map((b) => (
                <li
                  key={b.reference}
                  className={`manage-event-row${b.status === 'cancelled' || b.date < today ? ' manage-event-row--muted' : ''}`}
                >
                  <div className="manage-event-row__info">
                    <p className="manage-event-row__date">{b.date}</p>
                    <p className="manage-event-row__title">
                      {b.name} <span className="field-hint">(Ref: {b.reference})</span>
                      {b.status === 'cancelled' && <span className="status-pill status-pill--cancelled">Cancelled</span>}
                      {b.status !== 'cancelled' && b.date < today && <span className="status-pill status-pill--past">Past</span>}
                    </p>
                    <p className="manage-event-row__date">
                      {statusLabel(b.status)} · {b.paid ? 'Paid' : 'Awaiting payment'} ·{' '}
                      {EXEMPTION_LABELS[b.exemption] || b.exemption} · Total: {formatPounds(b.total)}
                      {refundedTotal(b) > 0 ? ` · Refunded: ${formatPounds(refundedTotal(b))}` : ''}
                    </p>
                    <p className="manage-event-row__date">
                      Created by {b.createdBy}
                      {b.lastUpdatedBy ? ` · Last updated by ${b.lastUpdatedBy}` : ''}
                    </p>
                    {b.calendarEventLink && (
                      <a href={b.calendarEventLink} target="_blank" rel="noopener noreferrer" className="manage-event-row__cal-link">
                        View in Calendar ↗
                      </a>
                    )}
                  </div>
                  <div className="manage-event-row__actions">
                    {b.status !== 'cancelled' && (
                      <button type="button" className="btn btn--ghost" onClick={() => setEditingReference(b.reference)}>
                        Edit
                      </button>
                    )}
                    {b.status === 'provisional' && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={actioningReference === b.reference}
                        onClick={() => handleConfirm(b)}
                      >
                        {actioningReference === b.reference ? 'Working…' : 'Confirm'}
                      </button>
                    )}
                    {b.status !== 'cancelled' && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={actioningReference === b.reference}
                        onClick={() => handleCancel(b)}
                      >
                        {actioningReference === b.reference ? 'Working…' : 'Cancel'}
                      </button>
                    )}
                    {(b.status === 'cancelled' || b.date < today) && (
                      <button type="button" className="btn btn--ghost" onClick={() => setViewingReference(b.reference)}>
                        View
                      </button>
                    )}
                    {b.status === 'cancelled' && b.paymentMethod === 'online' && b.paid && b.paymentDashboardUrl && (
                      <a href={b.paymentDashboardUrl} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">
                        Refund ↗
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {viewingBooking && (
        <BookingViewModal
          booking={viewingBooking}
          credential={credential}
          onCredentialInvalid={onCredentialInvalid}
          onClose={() => setViewingReference(null)}
          onRefundSaved={(updated) => {
            setBookings((current) => (current ? current.map((b) => (b.reference === updated.reference ? updated : b)) : current))
          }}
        />
      )}
    </div>
  )
}
