import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AddEventForm } from '../../components/AddEventForm'
import { ManageUpcomingEvents } from '../../components/ManageUpcomingEvents'
import type { AdminOutletContext } from './AdminLayout'

export function AdminEvents() {
  const { credential, onCredentialInvalid } = useOutletContext<AdminOutletContext>()
  const [manageListKey, setManageListKey] = useState(0)

  return (
    <>
      <div className="admin-tool">
        <h2 className="section-title section-title--small">Add event</h2>
        <AddEventForm
          credential={credential}
          onSaved={() => setManageListKey((k) => k + 1)}
          onCredentialInvalid={onCredentialInvalid}
        />
      </div>

      <div className="admin-tool">
        <h2 className="section-title section-title--small">Manage upcoming events</h2>
        <ManageUpcomingEvents key={manageListKey} credential={credential} onCredentialInvalid={onCredentialInvalid} />
      </div>

      <p className="field-hint">
        <Link to="/events">View the Events page →</Link>
      </p>
    </>
  )
}
