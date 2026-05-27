import { useMemo } from 'react'
import { Link } from 'react-router-dom'

// Import all committee and staff images dynamically
const committeeModules = import.meta.glob<{ default: string }>(
  '../assets/meet-the-team/committee/*.{jpg,jpeg,png,webp,svg}',
  { eager: true, import: 'default' },
)

const staffModules = import.meta.glob<{ default: string }>(
  '../assets/meet-the-team/staff/*.{jpg,jpeg,png,webp,svg}',
  { eager: true, import: 'default' },
)

interface TeamMember {
  order: number
  name: string
  roles: string
  image: string
}

function parseTeamMember(key: string, imgUrl: string): TeamMember {
  // Extract filename without path and extension, e.g. "1-paul_sherwood-chairman"
  const filename = key.split('/').pop()?.split('.')[0] || ''
  
  let order = Infinity
  let nameRaw = ''
  let rolesRaw: string[] = []

  // Custom pattern check: e.g. "kane_marshall_committee_member"
  if (!filename.includes('-') && filename.includes('_committee_member')) {
    nameRaw = filename.replace('_committee_member', '')
    rolesRaw = ['committee_member']
  } else {
    const parts = filename.split('-')
    const tempParts = [...parts]

    // Check if the first part is a number prefix
    const firstNum = parseInt(tempParts[0], 10)
    if (!isNaN(firstNum)) {
      order = firstNum
      tempParts.shift()
    }

    if (tempParts.length > 0) {
      nameRaw = tempParts[0]
      rolesRaw = tempParts.slice(1)
    }
  }

  // Format Name: capitalize first letters and replace underscores
  const name = nameRaw
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Format Roles
  const roles = rolesRaw
    .map((role) => {
      // Standardize common role names and corrections
      let cleaned = role.replace(/_/g, ' ')
      
      // Spelling correction
      if (cleaned.toLowerCase() === 'treasruer') {
        return 'Treasurer'
      }
      if (cleaned.toLowerCase() === 'committeemember') {
        return 'Committee Member'
      }
      if (cleaned === 'committeeMember') {
        return 'Committee Member'
      }
      if (cleaned === 'barManager') {
        return 'Bar Manager'
      }
      if (cleaned === 'barStaff') {
        return 'Bar Staff'
      }
      if (cleaned.toLowerCase() === 'fundraising volunteercoordinator') {
        return 'Fundraising & Volunteer Coordinator'
      }

      // Convert camelCase to Space Case
      cleaned = cleaned.replace(/([A-Z])/g, ' $1')

      return cleaned
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    })
    .join(' & ')

  return {
    order,
    name,
    roles: roles || 'Committee Member',
    image: imgUrl,
  }
}

export function Team() {
  const committee = useMemo(() => {
    return Object.entries(committeeModules)
      .map(([key, value]) => parseTeamMember(key, value))
      .sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order
        }
        return a.name.localeCompare(b.name)
      })
  }, [])

  const staff = useMemo(() => {
    return Object.entries(staffModules)
      .map(([key, value]) => parseTeamMember(key, value))
      .sort((a, b) => {
        // Donna (Bar Manager) first, otherwise alphabetical
        const aIsManager = a.roles.includes('Manager')
        const bIsManager = b.roles.includes('Manager')
        if (aIsManager && !bIsManager) return -1
        if (!aIsManager && bIsManager) return 1
        return a.name.localeCompare(b.name)
      })
  }, [])

  return (
    <section className="section">
      <div className="container">
        <div className="team-header">
          <h1 className="page-title">Meet the Team</h1>
          <p className="lede">
            Merriott Social Venue is a community-focused, non-profit organization run entirely by a
            dedicated committee of volunteers alongside our friendly bar staff. Meet the team who make it
            all possible!
          </p>
        </div>

        <div className="team-section">
          <h2 className="team-section__title">Our Committee</h2>
          <div className="team-grid">
            {committee.map((member, index) => (
              <article key={`committee-${index}`} className="team-card">
                <div className="team-card__image-container">
                  <img
                    src={member.image}
                    alt={`${member.name} — ${member.roles}`}
                    className="team-card__image"
                    loading="lazy"
                  />
                </div>
                <div className="team-card__content">
                  <h3 className="team-card__name">{member.name}</h3>
                  <p className="team-card__role">{member.roles}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="team-section">
          <h2 className="team-section__title">Our Staff</h2>
          <div className="team-grid">
            {staff.map((member, index) => (
              <article key={`staff-${index}`} className="team-card">
                <div className="team-card__image-container">
                  <img
                    src={member.image}
                    alt={`${member.name} — ${member.roles}`}
                    className="team-card__image"
                    loading="lazy"
                  />
                </div>
                <div className="team-card__content">
                  <h3 className="team-card__name">{member.name}</h3>
                  <p className="team-card__role">{member.roles}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="team-cta">
          <h2 className="team-cta__title">Want to make a difference in your community?</h2>
          <p className="team-cta__text">
            We're always looking for fresh ideas and new energy. No experience needed — just a
            willingness to help keep Merriott Social Venue at the heart of our village.
          </p>
          <Link to="/join" className="btn btn--primary btn--large">
            Join the Team
          </Link>
        </div>
      </div>
    </section>
  )
}
