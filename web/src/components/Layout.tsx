import { NavLink, Outlet } from 'react-router-dom'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link--active' : 'nav-link'

export function Layout() {
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
              Weekly events
            </NavLink>
            <NavLink
              to="/book"
              className={({ isActive }) => `${navLinkClass({ isActive })} nav-link--cta`}
            >
              Book function room
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <p>Merriott Social Venue · Merriott, Somerset, UK</p>
      </footer>

      <div className="sticky-book" role="region" aria-label="Book the function room">
        <NavLink to="/book" className="sticky-book__btn">
          Book function room
        </NavLink>
      </div>
    </div>
  )
}
