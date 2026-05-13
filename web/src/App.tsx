import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Book } from './pages/Book'
import { Events } from './pages/Events'
import { Home } from './pages/Home'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="events" element={<Events />} />
        <Route path="book" element={<Book />} />
      </Route>
    </Routes>
  )
}
