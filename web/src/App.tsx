import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminEvents } from './pages/admin/AdminEvents'
import { AdminBookings } from './pages/admin/AdminBookings'
import { AdminMembership } from './pages/admin/AdminMembership'
import { Book } from './pages/Book'
import { Events } from './pages/Events'
import { Home } from './pages/Home'
import { Join } from './pages/Join'
import { Team } from './pages/Team'
import { Constitution } from './pages/Constitution'
import { ScrollToTop } from './components/ScrollToTop'
import './App.css'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="events" element={<Events />} />
          <Route path="team" element={<Team />} />
          <Route path="join" element={<Join />} />
          <Route path="constitution" element={<Constitution />} />
          <Route path="book" element={<Book />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="events" replace />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="membership" element={<AdminMembership />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}
