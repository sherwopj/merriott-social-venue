import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { AddEventForm } from '../../components/AddEventForm'
import { ManageUpcomingEvents } from '../../components/ManageUpcomingEvents'
import type { AdminOutletContext } from './AdminLayout'

export function AdminEvents() {
  const { credential, onCredentialInvalid } = useOutletContext<AdminOutletContext>()
  const [manageListKey, setManageListKey] = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)

  return (
    <div className="admin-tool">
      <h2 className="section-title section-title--small">Manage upcoming events</h2>

      {showAddForm ? (
        <>
          <AddEventForm
            credential={credential}
            onSaved={() => {
              setShowAddForm(false)
              setManageListKey((k) => k + 1)
            }}
            onCredentialInvalid={onCredentialInvalid}
          />
          <button type="button" className="link-btn" onClick={() => setShowAddForm(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn--primary" onClick={() => setShowAddForm(true)}>
            + Add event
          </button>
          <ManageUpcomingEvents key={manageListKey} credential={credential} onCredentialInvalid={onCredentialInvalid} />
        </>
      )}

      <p className="field-hint">
        <Link to="/events">View the Events page →</Link>
      </p>
    </div>
  )
}
