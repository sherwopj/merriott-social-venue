import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { google } from 'googleapis'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 4000

const calendarId = process.env.GOOGLE_CALENDAR_ID
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
const calendarConfigured = Boolean(calendarId && serviceAccountJson)

let calendar: any = null
if (calendarConfigured) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(serviceAccountJson!),
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })
    calendar = google.calendar({ version: 'v3', auth })
  } catch (e) {
    console.error('Failed to initialize Google Calendar:', e)
  }
}

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

app.get('/api/calendar/availability', async (req, res) => {
  const { start, end } = req.query
  if (typeof start !== 'string' || typeof end !== 'string') {
    res.status(400).json({ error: 'start and end query params (ISO dates) are required' })
    return
  }

  if (!calendar || !calendarId) {
    res.json({ busy: [], calendarConfigured: false })
    return
  }

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date(start).toISOString(),
        timeMax: new Date(end).toISOString(),
        items: [{ id: calendarId }],
      },
    })

    const busy = response.data.calendars?.[calendarId]?.busy || []
    res.json({ busy, calendarConfigured: true })
  } catch (error: any) {
    console.error('Calendar error:', error)
    res.status(500).json({
      error: 'Failed to fetch availability',
      message: error.message,
      calendarConfigured: true,
    })
  }
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
