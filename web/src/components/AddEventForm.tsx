import { useState } from 'react'
import { apiUrl } from '../lib/apiBase'
import { EventAvailabilityCalendar } from './EventAvailabilityCalendar'
import type { UpcomingEvent } from '../data/upcomingEvents'

const CATEGORY_OPTIONS = [
  'Disco Night',
  'Tribute Show',
  'DJ Night',
  'Live Band',
  'BBQ / Street Party',
  'Christmas / Winter',
  'Cabaret Show',
  'Community / Volunteering',
]

const ROOM_OPTIONS = ['MSV Function Room', 'MSV Front Bar'] as const

function resolveInitialCategory(existingEvent?: UpcomingEvent): string {
  const match = CATEGORY_OPTIONS.find(
    (opt) => opt.toLowerCase() === (existingEvent?.category ?? '').toLowerCase(),
  )
  return match ?? CATEGORY_OPTIONS[0]
}

export function AddEventForm({
  credential,
  existingEvent,
  onSaved,
  onCredentialInvalid,
}: {
  credential: string
  existingEvent?: UpcomingEvent
  onSaved: (event: UpcomingEvent) => void
  onCredentialInvalid: () => void
}) {
  const isEditing = Boolean(existingEvent)

  const [title, setTitle] = useState(existingEvent?.title ?? '')
  const [description, setDescription] = useState(existingEvent?.description ?? '')
  const [category, setCategory] = useState(() => resolveInitialCategory(existingEvent))
  const [room, setRoom] = useState<(typeof ROOM_OPTIONS)[number]>(existingEvent?.room ?? 'MSV Function Room')
  const [startDate, setStartDate] = useState(existingEvent?.startDate ?? '')
  const [endDate, setEndDate] = useState(existingEvent?.endDate ?? '')
  const [ticketed, setTicketed] = useState(existingEvent?.ticketed ?? false)
  const [tbc, setTbc] = useState(existingEvent?.tbc ?? false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  // File inputs are uncontrolled in React — clearing the `photo` state doesn't clear what
  // the browser displays. Changing this key forces the input to remount blank.
  const [photoInputKey, setPhotoInputKey] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    setSuccessMessage(null)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('category', category)
      formData.append('room', room)
      formData.append('startDate', startDate)
      if (endDate) formData.append('endDate', endDate)
      formData.append('ticketed', ticketed ? 'yes' : 'no')
      formData.append('tbc', tbc ? 'yes' : 'no')
      if (photo) formData.append('photo', photo)

      let url = apiUrl('/api/upcoming-events')
      let method = 'POST'
      if (isEditing && existingEvent) {
        url = apiUrl(`/api/upcoming-events/${existingEvent.id}`)
        method = 'PUT'
        formData.append('currentImageUrl', existingEvent.image ?? '')
        formData.append('calendarEventId', existingEvent.calendarEventId ?? '')
        formData.append('calendarEventLink', existingEvent.calendarEventLink ?? '')
        formData.append('previousRoom', existingEvent.room ?? 'MSV Function Room')
        formData.append('removePhoto', removePhoto ? 'yes' : 'no')
      }

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${credential}` },
        body: formData,
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 401) {
          onCredentialInvalid()
          return
        }
        throw new Error(data?.error || `Request failed (${res.status})`)
      }

      onSaved(data.event as UpcomingEvent)
      setSuccessMessage(
        isEditing ? `"${data.event.title}" was updated.` : `"${data.event.title}" was added. View it on the Events page.`,
      )

      if (!isEditing) {
        setTitle('')
        setDescription('')
        setCategory(CATEGORY_OPTIONS[0])
        setRoom('MSV Function Room')
        setStartDate('')
        setEndDate('')
        setTicketed(false)
        setTbc(false)
      } else {
        setRemovePhoto(false)
      }
      setPhoto(null)
      setPhotoInputKey((k) => k + 1)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save the event')
    } finally {
      setSubmitting(false)
    }
  }

  const hasExistingPhoto = Boolean(existingEvent?.image) && !removePhoto

  return (
    <form onSubmit={handleSubmit} className="add-event-form">
      <label className="field">
        <span>Room</span>
        <select value={room} onChange={(e) => setRoom(e.target.value as (typeof ROOM_OPTIONS)[number])}>
          {ROOM_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Check availability &amp; pick a date</span>
        <EventAvailabilityCalendar room={room} selectedDate={startDate} onSelectDate={setStartDate} />
      </div>

      <div className="field-row">
        <label className="field">
          <span>Event date</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
        <label className="field">
          <span>End date (optional)</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} />
      </label>

      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      <label className="checkbox-field">
        <input type="checkbox" checked={ticketed} onChange={(e) => setTicketed(e.target.checked)} />
        Ticketed event
      </label>

      <label className="checkbox-field">
        <input type="checkbox" checked={tbc} onChange={(e) => setTbc(e.target.checked)} />
        Details still to be confirmed
      </label>

      {isEditing && hasExistingPhoto && (
        <div className="field">
          <span>Current photo</span>
          <div className="photo-preview">
            <img src={existingEvent!.image} alt="Current event" />
            <button type="button" className="link-btn" onClick={() => setRemovePhoto(true)}>
              Remove photo
            </button>
          </div>
        </div>
      )}

      <label className="field">
        <span>{hasExistingPhoto ? 'Replace photo' : 'Photo (optional)'}</span>
        <input
          key={photoInputKey}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add event'}
      </button>
      {submitError && <p className="submit-message submit-message--error">{submitError}</p>}
      {successMessage && <p className="submit-message">{successMessage}</p>}
    </form>
  )
}
