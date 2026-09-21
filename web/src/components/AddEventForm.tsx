import { useEffect, useRef, useState } from 'react'
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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

declare global {
  interface Window {
    google?: any
  }
}

// Decodes the JWT payload for display only (e.g. "Signed in as ..."). This is never a
// trust boundary — the server independently verifies the token's signature on submit.
function decodeEmailForDisplay(credential: string): string | null {
  try {
    const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

export function AddEventForm({ onCreated }: { onCreated: (event: UpcomingEvent) => void }) {
  const signInButtonRef = useRef<HTMLDivElement>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [credential, setCredential] = useState<string | null>(null)
  const [displayEmail, setDisplayEmail] = useState<string | null>(null)

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

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => setScriptReady(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!scriptReady || !GOOGLE_CLIENT_ID || credential || !signInButtonRef.current) return

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => {
        setCredential(response.credential)
        setDisplayEmail(decodeEmailForDisplay(response.credential))
      },
    })
    window.google.accounts.id.renderButton(signInButtonRef.current, { theme: 'outline', size: 'large' })
  }, [scriptReady, credential])

  if (!GOOGLE_CLIENT_ID) {
    return <p className="notice">Adding events from the website isn't set up yet.</p>
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!credential) return
    setSubmitting(true)
    setSubmitError(null)

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
        throw new Error(data?.error || `Request failed (${res.status})`)
      }

      onCreated(data.event as UpcomingEvent)
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

  if (!credential) {
    return (
      <div>
        <p className="field-hint">Sign in with an authorized Google account to add an event.</p>
        <div ref={signInButtonRef} />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="add-event-form">
      <p className="field-hint">
        Signed in as {displayEmail || 'you'} —{' '}
        <button type="button" className="link-btn" onClick={() => setCredential(null)}>
          not you?
        </button>
      </p>

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
    </form>
  )
}
