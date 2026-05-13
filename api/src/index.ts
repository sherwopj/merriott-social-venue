import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 4000

const webOrigins = (process.env.WEB_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: webOrigins.length > 0 ? webOrigins : true,
    credentials: true,
  }),
)
app.use(express.json({ limit: '32kb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

const calendarConfigured = Boolean(process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON)

app.get('/api/calendar/availability', (req, res) => {
  const start = req.query.start
  const end = req.query.end
  if (typeof start !== 'string' || typeof end !== 'string') {
    res.status(400).json({ error: 'start and end query params (ISO dates) are required' })
    return
  }
  res.json({
    busy: [] as { start: string; end: string }[],
    calendarConfigured,
  })
})

app.post('/api/bookings', (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    date,
    startTime,
    endTime,
    eventType,
    attendees,
    exemption,
    declaration,
    notes,
  } = req.body ?? {}

  if (!name || !email || !phone || !date || !declaration) {
    res.status(400).json({ error: 'Required fields missing: name, email, phone, date, and declaration are required.' })
    return
  }

  const reference = `MSV-${Date.now().toString(36).toUpperCase()}`
  console.info('[booking]', {
    reference,
    name,
    email,
    phone,
    address,
    date,
    startTime,
    endTime,
    eventType,
    attendees,
    exemption,
    declaration,
    notes,
  })

  res.json({ ok: true, reference })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
