import { useState } from 'react'
import { apiUrl } from '../lib/apiBase'
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

export function AddEventForm({
  credential,
  onCreated,
  onCredentialInvalid,
}: {
  credential: string
  onCreated: (event: UpcomingEvent) => void
  onCredentialInvalid: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [ticketed, setTicketed] = useState(false)
  const [tbc, setTbc] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)

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
      formData.append('startDate', startDate)
      if (endDate) formData.append('endDate', endDate)
      formData.append('ticketed', ticketed ? 'yes' : 'no')
      formData.append('tbc', tbc ? 'yes' : 'no')
      if (photo) formData.append('photo', photo)

      const res = await fetch(apiUrl('/api/upcoming-events'), {
        method: 'POST',
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

      onCreated(data.event as UpcomingEvent)
      setSuccessMessage(`"${data.event.title}" was added. View it on the Events page.`)
      setTitle('')
      setDescription('')
      setCategory(CATEGORY_OPTIONS[0])
      setStartDate('')
      setEndDate('')
      setTicketed(false)
      setTbc(false)
      setPhoto(null)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not add the event')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="add-event-form">
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

      <label className="field">
        <span>Photo (optional)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
      </label>

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add event'}
      </button>
      {submitError && <p className="submit-message submit-message--error">{submitError}</p>}
      {successMessage && <p className="submit-message">{successMessage}</p>}
    </form>
  )
}
