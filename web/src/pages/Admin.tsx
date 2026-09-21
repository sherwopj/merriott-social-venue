import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AddEventForm } from '../components/AddEventForm'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

declare global {
  interface Window {
    google?: any
  }
}

// Decodes the JWT payload for display only (e.g. "Signed in as ..."). This is never a
// trust boundary — the server independently verifies the token's signature on every request.
function decodeEmailForDisplay(credential: string): string | null {
  try {
    const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.email === 'string' ? payload.email : null
  } catch {
    return null
  }
}

export function Admin() {
  const signInButtonRef = useRef<HTMLDivElement>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const [credential, setCredential] = useState<string | null>(null)
  const [displayEmail, setDisplayEmail] = useState<string | null>(null)

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

  return (
    <section className="section">
      <div className="container container--narrow">
        <h1 className="page-title">Admin</h1>
        <p className="lede">Tools for committee members. Sign in with an authorized Google account.</p>

        {!GOOGLE_CLIENT_ID && <p className="notice">Sign-in isn't set up yet.</p>}

        {GOOGLE_CLIENT_ID && !credential && <div ref={signInButtonRef} />}

        {credential && (
          <>
            <p className="field-hint">
              Signed in as {displayEmail || 'you'} —{' '}
              <button type="button" className="link-btn" onClick={() => setCredential(null)}>
                not you?
              </button>
            </p>

            <div className="admin-tool">
              <h2 className="section-title section-title--small">Add event</h2>
              <AddEventForm
                credential={credential}
                onCreated={() => {
                  /* success message is shown inline by the form itself */
                }}
              />
            </div>

            <p className="field-hint">
              <Link to="/events">View the Events page →</Link>
            </p>
          </>
        )}
      </div>
    </section>
  )
}
