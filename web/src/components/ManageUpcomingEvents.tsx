import { useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import type { UpcomingEvent } from '../data/upcomingEvents'
import { AddEventForm } from './AddEventForm'

type UpcomingEventsResponse = {
  sheetConfigured: boolean
  events: UpcomingEvent[]
}

export function ManageUpcomingEvents({
  credential,
  onCredentialInvalid,
}: {
  credential: string
  onCredentialInvalid: () => void
}) {
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null)
  const [sheetConfigured, setSheetConfigured] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    return fetch(apiUrl('/api/upcoming-events'))
      .then((res) =>
        res.ok ? (res.json() as Promise<UpcomingEventsResponse>) : Promise.reject(new Error(`Request failed (${res.status})`)),
      )
      .then((data) => {
        setSheetConfigured(data.sheetConfigured)
        setEvents([...data.events].sort((a, b) => a.startDate.localeCompare(b.startDate)))
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Could not load events'))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(ev: UpcomingEvent) {
    if (!window.confirm(`Delete "${ev.title}"? This can't be undone.`)) return

    setDeletingId(ev.id)
    setDeleteError(null)
    try {
      const res = await fetch(apiUrl(`/api/upcoming-events/${ev.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarEventId: ev.calendarEventId, imageUrl: ev.image }),
      })
      if (!res.ok) {
        if (res.status === 401) {
          onCredentialInvalid()
          return
        }
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Request failed (${res.status})`)
      }
      await load()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the event')
    } finally {
      setDeletingId(null)
    }
  }

  if (loadError) return <p className="notice">Could not load events: {loadError}</p>
  if (!sheetConfigured) return <p className="notice">Events sheet isn't configured on the server yet.</p>
  if (!events) return <p className="field-hint">Loading…</p>

  const editingEvent = events.find((ev) => ev.id === editingId) ?? null

  return (
    <div>
      {deleteError && <p className="submit-message submit-message--error">{deleteError}</p>}

      {events.length === 0 ? (
        <p className="field-hint">No upcoming events yet.</p>
      ) : (
        <ul className="manage-events-list">
          {events.map((ev) => (
            <li key={ev.id} className="manage-event-row">
              {ev.image ? (
                <img src={ev.image} alt="" className="manage-event-row__thumb" />
              ) : (
                <div className="manage-event-row__thumb" />
              )}
              <div className="manage-event-row__info">
                <p className="manage-event-row__title">{ev.title}</p>
                <p className="manage-event-row__date">
                  {ev.startDate}
                  {ev.endDate ? ` – ${ev.endDate}` : ''}
                </p>
              </div>
              <div className="manage-event-row__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setEditingId(ev.id)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={deletingId === ev.id}
                  onClick={() => handleDelete(ev)}
                >
                  {deletingId === ev.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingEvent && (
        <div className="admin-tool">
          <h3 className="section-title section-title--small">Edit event</h3>
          <AddEventForm
            credential={credential}
            existingEvent={editingEvent}
            onSaved={() => {
              setEditingId(null)
              void load()
            }}
            onCredentialInvalid={onCredentialInvalid}
          />
          <button type="button" className="link-btn" onClick={() => setEditingId(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
