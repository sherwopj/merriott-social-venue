import { Fragment, useCallback, useEffect, useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { SessionExpiredError, adminFetch } from '../lib/adminApi'
import type { UpcomingEvent } from '../data/upcomingEvents'
import { AddEventForm } from './AddEventForm'
import { EventIcon } from './EventIcon'

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
      await adminFetch(apiUrl(`/api/upcoming-events/${ev.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarEventId: ev.calendarEventId,
          imageUrl: ev.image,
          room: ev.room,
          title: ev.title,
          startDate: ev.startDate,
        }),
      }, onCredentialInvalid)
      await load()
    } catch (err) {
      if (err instanceof SessionExpiredError) return
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the event')
    } finally {
      setDeletingId(null)
    }
  }

  if (loadError) return <p className="notice">Could not load events: {loadError}</p>
  if (!sheetConfigured) return <p className="notice">Events sheet isn't configured on the server yet.</p>
  if (!events) return <p className="field-hint">Loading…</p>

  return (
    <div>
      {deleteError && <p className="submit-message submit-message--error">{deleteError}</p>}

      {events.length === 0 ? (
        <p className="field-hint">No upcoming events yet.</p>
      ) : (
        <ul className="manage-events-list">
          {events.map((ev) => (
            <Fragment key={ev.id}>
              <li className="manage-event-row">
                {ev.image ? (
                  <img src={ev.image} alt="" className="manage-event-row__thumb" />
                ) : (
                  <div className="manage-event-row__thumb manage-event-row__thumb--icon">
                    <EventIcon name={ev.icon} />
                  </div>
                )}
                <div className="manage-event-row__info">
                  <p className="manage-event-row__date">
                    {ev.startDate}
                    {ev.startTime && ev.endTime ? ` · ${ev.startTime}–${ev.endTime}` : ''}
                  </p>
                  <p className="manage-event-row__title">{ev.title}</p>
                  <p className="manage-event-row__date">{ev.room ?? 'MSV Function Room'}</p>
                  {(ev.addedBy || ev.lastUpdatedBy) && (
                    <p className="manage-event-row__date">
                      {ev.addedBy && `Added by ${ev.addedBy}`}
                      {ev.addedBy && ev.lastUpdatedBy ? ' · ' : ''}
                      {ev.lastUpdatedBy && `Last updated by ${ev.lastUpdatedBy}`}
                    </p>
                  )}
                  {ev.calendarEventLink && (
                    <a href={ev.calendarEventLink} target="_blank" rel="noopener noreferrer" className="manage-event-row__cal-link">
                      View in Calendar ↗
                    </a>
                  )}
                </div>
                <div className="manage-event-row__actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setEditingId(editingId === ev.id ? null : ev.id)}
                  >
                    {editingId === ev.id ? 'Close' : 'Edit'}
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
              {editingId === ev.id && (
                <li className="manage-event-edit-panel">
                  <div className="admin-tool">
                    <h3 className="section-title section-title--small">Edit event</h3>
                    <AddEventForm
                      credential={credential}
                      existingEvent={ev}
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
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}
