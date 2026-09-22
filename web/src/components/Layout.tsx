import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isBookingPage = location.pathname === '/book'
  const isAdminPage = location.pathname.startsWith('/admin')

  return (
    <div className="layout">
      <header className="site-header">
        <div className="header-inner">
          <NavLink to="/" className="brand" end>
            <span className="brand__main">Merriott</span>
            <span className="brand__sub">Social Venue</span>
          </NavLink>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" className={navLinkClass} end>
              Home
            </NavLink>
            <NavLink to="/events" className={navLinkClass}>
              What's On
            </NavLink>
            <NavLink to="/team" className={navLinkClass}>
              <span className="nav-text-desktop">Meet the team</span>
              <span className="nav-text-mobile">Team</span>
            </NavLink>
            <NavLink
              to="/book"
              className={({ isActive }) => `${navLinkClass({ isActive })} nav-link--cta`}
            >
              <span className="nav-text-desktop">Book function room</span>
              <span className="nav-text-mobile">Bookings</span>
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>
          <span
            className="footer-admin-entry"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/admin')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate('/admin')
              }
            }}
          >
            Merriott Social Venue
          </span>{' '}
          · Merriott, Somerset, UK
        </p>
      </footer>

      {!isBookingPage && !isAdminPage && (
        <div className="sticky-book" role="region" aria-label="Book the function room">
          <NavLink to="/book" className="sticky-book__btn">
            Book function room
          </NavLink>
        </div>
      )}
    </div>
  )
}
