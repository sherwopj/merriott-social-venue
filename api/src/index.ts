import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import { google } from 'googleapis'
import multer from 'multer'
import { Resend } from 'resend'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 4000

const calendarId = process.env.GOOGLE_CALENDAR_ID
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
const calendarConfigured = Boolean(calendarId && serviceAccountJson)

const sheetId = process.env.GOOGLE_SHEET_ID
const sheetRange = process.env.GOOGLE_SHEET_RANGE || 'A2:J1000'
const sheetConfigured = Boolean(sheetId && serviceAccountJson)

const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID
const googleOAuthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID
const googleOAuthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
const driveOwnerRefreshToken = process.env.GOOGLE_DRIVE_OWNER_REFRESH_TOKEN
const eventEditorEmails = (process.env.EVENT_EDITOR_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

let calendar: any = null
let sheets: any = null
if (calendarConfigured || sheetConfigured) {
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
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    })
    calendar = google.calendar({ version: 'v3', auth })
    sheets = google.sheets({ version: 'v4', auth })
  } catch (e) {
    console.error('Failed to initialize Google API client:', e)
  }
}

// Service accounts have no Drive storage quota of their own, so photo uploads run as the
// real merriottsocialvenue@gmail.com account instead, via a refresh token obtained once.
let driveAsOwner: any = null
if (googleOAuthClientId && googleOAuthClientSecret && driveOwnerRefreshToken) {
  const driveOwnerAuth = new google.auth.OAuth2(googleOAuthClientId, googleOAuthClientSecret)
  driveOwnerAuth.setCredentials({ refresh_token: driveOwnerRefreshToken })
  driveAsOwner = google.drive({ version: 'v3', auth: driveOwnerAuth })
}

async function verifyEditorEmail(authorizationHeader: string | undefined): Promise<string | null> {
  if (!googleOAuthClientId || eventEditorEmails.length === 0) return null
  const idToken = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!idToken) return null

  try {
    const client = new google.auth.OAuth2(googleOAuthClientId)
    const ticket = await client.verifyIdToken({ idToken, audience: googleOAuthClientId })
    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) return null

    const email = payload.email.trim().toLowerCase()
    return eventEditorEmails.includes(email) ? email : null
  } catch (e) {
    console.warn('[upcoming-events] ID token verification failed:', e)
    return null
  }
}

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
  },
})

// Resend setup
const resendApiKey = process.env.RESEND_API_KEY
const emailConfigured = Boolean(resendApiKey)
const resend = resendApiKey ? new Resend(resendApiKey) : null

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

// ---- Upcoming events (Google Sheet, fed by a Form) ----

type IconName =
  | 'handsHeart'
  | 'discoBall'
  | 'starMic'
  | 'vinylRecord'
  | 'guitarBand'
  | 'bbqFlag'
  | 'santaHat'
  | 'feathers'

type UpcomingEvent = {
  id: string
  startDate: string
  endDate?: string
  title: string
  description: string
  kicker: string
  icon: IconName
  image?: string
  ticketed?: boolean
  tbc?: boolean
}

// Keyed by the Form's "Category" dropdown option (case-insensitive).
const CATEGORY_MAP: Record<string, { icon: IconName; kicker: string }> = {
  'disco night': { icon: 'discoBall', kicker: 'Disco Night' },
  'tribute show': { icon: 'starMic', kicker: 'Tribute Show' },
  'dj night': { icon: 'vinylRecord', kicker: 'DJ Night' },
  'live band': { icon: 'guitarBand', kicker: 'Live Band' },
  'bbq / street party': { icon: 'bbqFlag', kicker: 'Celebration' },
  'christmas / winter': { icon: 'santaHat', kicker: 'Celebration' },
  'cabaret show': { icon: 'feathers', kicker: 'Cabaret Show' },
  'community / volunteering': { icon: 'handsHeart', kicker: 'Community' },
}
const DEFAULT_CATEGORY = { icon: 'discoBall' as IconName, kicker: 'Special Event' }

function parseSheetDate(raw: string | undefined): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const uk = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (uk) {
    const [, d, m, y] = uk
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function parseYesNo(raw: string | undefined): boolean {
  return /^y(es)?$/i.test((raw ?? '').trim())
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseUpcomingEventsRows(rows: string[][]): UpcomingEvent[] {
  const events: UpcomingEvent[] = []
  rows.forEach((row, index) => {
    const [, rawStart, rawEnd, title, description, category, ticketed, tbc, , photoDirectUrl] = row
    if (!title || !title.trim()) return

    const startDate = parseSheetDate(rawStart)
    if (!startDate) {
      console.warn(`[upcoming-events] Skipping row ${index + 2}: unparseable or missing date`)
      return
    }

    const endDate = parseSheetDate(rawEnd) ?? undefined
    const categoryInfo = CATEGORY_MAP[(category ?? '').trim().toLowerCase()] ?? DEFAULT_CATEGORY
    if (category && !CATEGORY_MAP[category.trim().toLowerCase()]) {
      console.warn(`[upcoming-events] Row ${index + 2}: unrecognized category "${category}", using default`)
    }

    events.push({
      id: `${startDate}-${slugify(title)}`,
      startDate,
      endDate,
      title: title.trim(),
      description: (description ?? '').trim(),
      kicker: categoryInfo.kicker,
      icon: categoryInfo.icon,
      image: photoDirectUrl && photoDirectUrl.trim() ? photoDirectUrl.trim() : undefined,
      ticketed: parseYesNo(ticketed) || undefined,
      tbc: parseYesNo(tbc) || undefined,
    })
  })
  return events
}

const UPCOMING_EVENTS_CACHE_TTL_MS = 5 * 60 * 1000
let upcomingEventsCache: { events: UpcomingEvent[]; fetchedAt: number } = { events: [], fetchedAt: 0 }

async function getUpcomingEvents(): Promise<UpcomingEvent[]> {
  const isFresh = Date.now() - upcomingEventsCache.fetchedAt < UPCOMING_EVENTS_CACHE_TTL_MS
  if (isFresh) return upcomingEventsCache.events

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetRange,
    })
    const rows: string[][] = response.data.values || []
    const events = parseUpcomingEventsRows(rows)
    upcomingEventsCache = { events, fetchedAt: Date.now() }
    return events
  } catch (error) {
    console.error('[upcoming-events] Failed to fetch sheet, serving last-known list:', error)
    return upcomingEventsCache.events
  }
}

app.get('/api/upcoming-events', async (_req, res) => {
  if (!sheets || !sheetConfigured) {
    res.json({ sheetConfigured: false, events: [] })
    return
  }

  const events = await getUpcomingEvents()
  res.json({ sheetConfigured: true, events })
})

app.post(
  '/api/upcoming-events',
  (req, res, next) => {
    photoUpload.single('photo')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: `Invalid photo upload: ${err.message}` })
        return
      }
      next()
    })
  },
  async (req, res) => {
    const editorEmail = await verifyEditorEmail(req.headers.authorization)
    if (!editorEmail) {
      res.status(401).json({ error: 'Sign-in required or not authorized to add events.' })
      return
    }

    if (!sheets || !sheetConfigured) {
      res.status(503).json({ error: 'Events sheet is not configured on the server.' })
      return
    }

    const { title, description, category, startDate, endDate, ticketed, tbc } = req.body ?? {}
    const categoryInfo = category ? CATEGORY_MAP[String(category).trim().toLowerCase()] : undefined
    const parsedStartDate = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null

    if (!title || !description || !categoryInfo || !parsedStartDate) {
      res.status(400).json({
        error: 'title, description, a valid startDate (YYYY-MM-DD), and a recognized category are required.',
      })
      return
    }
    const parsedEndDate =
      typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : ''

    let photoDirectUrl = ''
    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string } | undefined
    if (file && driveAsOwner && driveFolderId) {
      try {
        const { Readable } = await import('stream')
        const created = await driveAsOwner.files.create({
          requestBody: { name: `${Date.now()}-${file.originalname}`, parents: [driveFolderId] },
          media: { mimeType: file.mimetype, body: Readable.from(file.buffer) },
          fields: 'id',
        })
        const fileId = created.data.id
        await driveAsOwner.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' },
        })
        photoDirectUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
      } catch (e) {
        console.error(`[upcoming-events] Photo upload by ${editorEmail} failed, continuing without it:`, e)
      }
    } else if (file && (!driveAsOwner || !driveFolderId)) {
      console.warn('[upcoming-events] Photo submitted but Drive upload is not fully configured; skipping upload.')
    }

    try {
      // Deliberately not sheetRange here: append's "find the last row" search is scoped to
      // whatever range you give it, so a narrow configured read-range would otherwise anchor
      // every append to that same window and overwrite instead of adding a new row.
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'A:J',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toISOString(),
            parsedStartDate,
            parsedEndDate,
            String(title).trim(),
            String(description).trim(),
            String(category).trim(),
            parseYesNo(ticketed) ? 'Yes' : 'No',
            parseYesNo(tbc) ? 'Yes' : 'No',
            '',
            photoDirectUrl,
          ]],
        },
      })
    } catch (e) {
      console.error(`[upcoming-events] Failed to append row (added by ${editorEmail}):`, e)
      res.status(502).json({ error: 'Failed to save the event to the sheet.' })
      return
    }

    upcomingEventsCache.fetchedAt = 0 // force the next GET to pick this up immediately
    console.info(`[upcoming-events] Event "${title}" added by ${editorEmail}`)

    if (calendar && calendarId) {
      try {
        await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: String(title).trim(),
            description: `${String(description).trim()}\n\nCategory: ${categoryInfo.kicker}\nAdded via website by ${editorEmail}`,
            start: { date: parsedStartDate },
            end: { date: addDays(parsedEndDate || parsedStartDate, 1) },
          },
        })
      } catch (e) {
        console.error(`[upcoming-events] Failed to create calendar event for "${title}":`, e)
      }
    }

    res.status(201).json({
      event: {
        id: `${parsedStartDate}-${slugify(String(title))}`,
        startDate: parsedStartDate,
        endDate: parsedEndDate || undefined,
        title: String(title).trim(),
        description: String(description).trim(),
        kicker: categoryInfo.kicker,
        icon: categoryInfo.icon,
        image: photoDirectUrl || undefined,
        ticketed: parseYesNo(ticketed) || undefined,
        tbc: parseYesNo(tbc) || undefined,
      },
    })
  },
)

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
    sendCopyToHirer,
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
    reference, name, email, phone, address, date,
    startTime, endTime, eventType, attendees, exemption, declaration, notes,
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
      const calendarRes = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: eventSummary,
          description: eventDescription,
          start: { dateTime: `${date}T${startTime || '00:00'}:00`, timeZone: 'Europe/London' },
          end: { dateTime: `${date}T${endTime || '00:00'}:00`, timeZone: 'Europe/London' },
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

  // Send email via Resend
  if (emailConfigured && resend) {
    try {
      const recipient = process.env.NOTIFICATION_EMAIL_TO || 'merriottsocialvenue@gmail.com'
      const fromAddress = process.env.EMAIL_FROM || 'bookings@merriottsocialvenue.co.uk'

      const calendarLinkSection = htmlLink
        ? `<p><strong>Google Calendar Event Link:</strong> <a href="${htmlLink}">${htmlLink}</a></p>`
        : '<p><em>Note: Google Calendar event link could not be generated.</em></p>'

      const recipients = Array.isArray(recipient) ? [...recipient] : [recipient]
      if (sendCopyToHirer && email && typeof email === 'string' && !recipients.includes(email)) {
        recipients.push(email)
      }

      const { error } = await resend.emails.send({
        from: fromAddress,
        to: recipients,
        subject: `Provisional Booking Request: ${name} (Ref: ${reference})`,
        html: `
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
        `,
      })

      if (error) {
        console.error('[booking] Failed to send notification email:', error)
      } else {
        console.log(`[booking] Notification email sent to ${recipients.join(', ')}`)
      }
    } catch (e) {
      console.error('[booking] Failed to send notification email:', e)
    }
  } else {
    console.warn('[booking] Resend not configured. Notification email skipped.')
  }

  res.json({ ok: true, reference })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(port, '0.0.0.0', function () {
  console.log(`API listening on http://localhost:${port}`)
})