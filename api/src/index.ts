import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import { google } from 'googleapis'
import nodemailer from 'nodemailer'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 4000

const calendarId = process.env.GOOGLE_CALENDAR_ID
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
const calendarConfigured = Boolean(calendarId && serviceAccountJson)

let calendar: any = null
if (calendarConfigured) {
  try {
    let credentials: any = null
    const jsonStr = serviceAccountJson!.trim()
    if (jsonStr.startsWith('{')) {
      credentials = JSON.parse(jsonStr)
    } else {
      credentials = JSON.parse(fs.readFileSync(serviceAccountJson!, 'utf8'))
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    })
    calendar = google.calendar({ version: 'v3', auth })
  } catch (e) {
    console.error('Failed to initialize Google Calendar:', e)
  }
}

// Nodemailer SMTP Transporter setup
const smtpHost = process.env.SMTP_HOST
const smtpPort = Number(process.env.SMTP_PORT) || 587
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass)

const transporter = nodemailer.createTransport({
  host: smtpHost || '',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser || '',
    pass: smtpPass || '',
  },
  family: 4, // Force IPv4 to prevent connection issues on hosts with partial IPv6 configuration
})


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

app.post('/api/bookings', async (req, res) => {
  const {
    name,
    email,
    phone,
    middleName,
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

  // Honeypot anti-spam check
  if (middleName) {
    const fakeReference = `MSV-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
    console.warn(`[spam-blocked] Blocked automated bot booking with reference ${fakeReference}. (Honeypot hit: middleName='${middleName}')`)
    res.json({ ok: true, reference: fakeReference })
    return
  }

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

  let htmlLink = ''
  if (calendar && calendarId) {
    try {
      const eventSummary = `PROVISIONAL: ${name} - ${phone} (Ref: ${reference})`
      const eventDescription = `Provisional Booking Request
Reference: ${reference}

Hirer Details:
- Name: ${name}
- Email: ${email}
- Phone: ${phone}
- Address: ${address || 'Not provided'}

Booking Details:
- Date: ${date}
- Time: ${startTime || 'N/A'} - ${endTime || 'N/A'}
- Event Type: ${eventType || 'N/A'}
- Attendees: ${attendees || 'N/A'}
- Exemption status: ${exemption || 'none'}

Additional Notes:
${notes || 'None'}
`
      const startDateTime = `${date}T${startTime || '00:00'}:00`
      const endDateTime = `${date}T${endTime || '00:00'}:00`

      const calendarRes = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: eventSummary,
          description: eventDescription,
          start: {
            dateTime: startDateTime,
            timeZone: 'Europe/London',
          },
          end: {
            dateTime: endDateTime,
            timeZone: 'Europe/London',
          },
        },
      })
      htmlLink = calendarRes.data.htmlLink || ''
      console.log(`[booking] Google Calendar event created: ${htmlLink}`)
    } catch (e) {
      console.error('[booking] Failed to create Google Calendar event:', e)
    }
  } else {
    console.warn('[booking] Google Calendar integration not configured or initialized.')
  }

  // Send email via Nodemailer
  if (smtpConfigured) {
    try {
      const recipient = process.env.NOTIFICATION_EMAIL_TO || 'merriottsocialvenue@gmail.com'
      const mailSubject = `Provisional Booking Request: ${name} (Ref: ${reference})`

      const calendarLinkSection = htmlLink
        ? `<p><strong>Google Calendar Event Link:</strong> <a href="${htmlLink}">${htmlLink}</a></p>`
        : '<p><em>Note: Google Calendar event link could not be generated.</em></p>'

      const mailBody = `
        <h2>New Provisional Booking Request</h2>
        <p>A new request has been submitted with reference <strong>${reference}</strong>.</p>
        
        <h3>Booking Details:</h3>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Address:</strong> ${address || 'Not provided'}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Time:</strong> ${startTime || 'N/A'} - ${endTime || 'N/A'}</li>
          <li><strong>Event Type:</strong> ${eventType || 'N/A'}</li>
          <li><strong>Attendees:</strong> ${attendees || 'N/A'}</li>
          <li><strong>Exemption status:</strong> ${exemption || 'none'}</li>
        </ul>
        
        ${notes ? `<h3>Notes:</h3><p>${notes}</p>` : ''}
        
        ${calendarLinkSection}
        
        <p>Please check the calendar, then get in touch with the hirer to confirm and handle the payment.</p>
      `

      await transporter.sendMail({
        from: process.env.SMTP_FROM || smtpUser || '',
        to: recipient,
        subject: mailSubject,
        html: mailBody,
      })
      console.log(`[booking] Notification email sent to ${recipient}`)
    } catch (e) {
      console.error('[booking] Failed to send notification email:', e)
    }
  } else {
    console.warn('[booking] SMTP not configured. Notification email skipped.')
  }

  res.json({ ok: true, reference })
})


app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(port, "0.0.0.0", function () {
  console.log(`API listening on http://localhost:${port}`)
})
