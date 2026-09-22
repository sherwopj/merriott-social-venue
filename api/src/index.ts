import cors from 'cors'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import { google } from 'googleapis'
import multer from 'multer'
import { Resend } from 'resend'
import Stripe from 'stripe'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 4000

const calendarId = process.env.GOOGLE_CALENDAR_ID
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
const calendarConfigured = Boolean(calendarId && serviceAccountJson)

const sheetId = process.env.GOOGLE_SHEET_ID
const sheetRange = process.env.GOOGLE_SHEET_RANGE || 'A2:L1000'
const sheetConfigured = Boolean(sheetId && serviceAccountJson)

const bookingsSheetId = process.env.GOOGLE_BOOKINGS_SHEET_ID
const bookingsSheetRange = process.env.GOOGLE_BOOKINGS_SHEET_RANGE || 'A2:Y1000'
const bookingsSheetConfigured = Boolean(bookingsSheetId && serviceAccountJson)

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
if (calendarConfigured || sheetConfigured || bookingsSheetConfigured) {
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

// Stripe setup
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null
const stripeTestMode = stripeSecretKey?.startsWith('sk_test_') ?? false

function stripePaymentDashboardUrl(paymentIntentId: string): string {
  return `https://dashboard.stripe.com/${stripeTestMode ? 'test/' : ''}payments/${paymentIntentId}`
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
app.use((req, res, next) => {
  // The Stripe webhook needs the raw request body to verify its signature, so it's exempted
  // from the global JSON parser and mounts its own express.raw() instead.
  if (req.originalUrl === '/api/stripe/webhook') {
    next()
    return
  }
  express.json({ limit: '32kb' })(req, res, next)
})

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
  id: string // stable UID (sheet column L) once set; falls back to a date+title slug for
  // legacy rows created before that column existed — those aren't editable/deletable
  // through the API until re-created, since there's no stable key to find them by.
  row?: number // current row at the time of the read; never trust this across requests
  startDate: string
  endDate?: string
  title: string
  description: string
  category?: string // raw category string, e.g. for pre-filling an edit form's dropdown
  kicker: string
  icon: IconName
  image?: string
  ticketed?: boolean
  tbc?: boolean
  calendarEventId?: string
  calendarEventLink?: string
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

function extractDriveFileId(url: string | undefined): string | null {
  const match = (url ?? '').match(/[?&]id=([^&]+)/)
  return match ? match[1] : null
}

async function deleteDriveFile(url: string | undefined): Promise<void> {
  const fileId = extractDriveFileId(url)
  if (!fileId || !driveAsOwner) return
  try {
    await driveAsOwner.files.delete({ fileId })
  } catch (e) {
    console.warn('[events] Failed to delete old Drive file (continuing):', e)
  }
}

async function uploadPhoto(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<string> {
  if (!driveAsOwner || !driveFolderId) {
    console.warn('[events] Photo submitted but Drive upload is not fully configured; skipping upload.')
    return ''
  }
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
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
  } catch (e) {
    console.error('[events] Photo upload failed, continuing without it:', e)
    return ''
  }
}

const sheetTabIdCache = new Map<string, number>()
async function getSheetTabId(targetSheetId: string, tabName?: string): Promise<number | null> {
  const cacheKey = `${targetSheetId}:${tabName ?? '__default__'}`
  if (sheetTabIdCache.has(cacheKey)) return sheetTabIdCache.get(cacheKey)!
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: targetSheetId, fields: 'sheets.properties' })
    const sheetsList = meta.data.sheets ?? []
    const match = tabName
      ? sheetsList.find((s: any) => s.properties?.title === tabName)
      : sheetsList[0]
    const id = match?.properties?.sheetId
    if (typeof id !== 'number') return null
    sheetTabIdCache.set(cacheKey, id)
    return id
  } catch (e) {
    console.error('[events] Failed to resolve sheet tab id:', e)
    return null
  }
}

function buildCalendarEventBody(
  title: string,
  description: string,
  kicker: string,
  editorEmail: string,
  startDate: string,
  endDate: string,
) {
  return {
    summary: title,
    description: `${description}\n\nCategory: ${kicker}\nAdded via website by ${editorEmail}`,
    start: { date: startDate },
    end: { date: addDays(endDate || startDate, 1) },
  }
}

function parseUpcomingEventsRows(rows: string[][]): UpcomingEvent[] {
  const events: UpcomingEvent[] = []
  rows.forEach((row, index) => {
    const [, rawStart, rawEnd, title, description, category, ticketed, tbc, photoDirectUrl, calendarEventId, calendarEventLink, uid] = row
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
      id: uid && uid.trim() ? uid.trim() : `${startDate}-${slugify(title)}`,
      row: index + 2,
      startDate,
      endDate,
      title: title.trim(),
      description: (description ?? '').trim(),
      category: category && category.trim() ? category.trim() : undefined,
      kicker: categoryInfo.kicker,
      icon: categoryInfo.icon,
      image: photoDirectUrl && photoDirectUrl.trim() ? photoDirectUrl.trim() : undefined,
      ticketed: parseYesNo(ticketed) || undefined,
      tbc: parseYesNo(tbc) || undefined,
      calendarEventId: calendarEventId && calendarEventId.trim() ? calendarEventId.trim() : undefined,
      calendarEventLink: calendarEventLink && calendarEventLink.trim() ? calendarEventLink.trim() : undefined,
    })
  })
  return events
}

// Finds the row currently holding the given UID (column L) with a fresh read — never trusts
// a row number from an earlier request, since rows shift after any delete.
async function findRowByUid(uid: string): Promise<number | null> {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'A:L' })
    const rows: string[][] = response.data.values || []
    const index = rows.findIndex((row) => (row[11] ?? '').trim() === uid)
    return index === -1 ? null : index + 1 // rows[] is 0-indexed from row 1 (the header)
  } catch (e) {
    console.error(`[upcoming-events] Failed to look up row for uid ${uid}:`, e)
    return null
  }
}

// Computes the next empty row by counting existing data rather than relying on
// values.append's own "find the table" guess, which we've seen land on the wrong row.
async function getNextEmptyRow(): Promise<number> {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'A:A' })
  const rows: string[][] = response.data.values || []
  return rows.length + 1
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

    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string } | undefined
    const photoDirectUrl = file ? await uploadPhoto(file) : ''

    let calendarEventId = ''
    let calendarEventLink = ''
    if (calendar && calendarId) {
      try {
        const created = await calendar.events.insert({
          calendarId,
          requestBody: buildCalendarEventBody(
            String(title).trim(),
            String(description).trim(),
            categoryInfo.kicker,
            editorEmail,
            parsedStartDate,
            parsedEndDate,
          ),
        })
        calendarEventId = created.data.id ?? ''
        calendarEventLink = created.data.htmlLink ?? ''
      } catch (e) {
        console.error(`[upcoming-events] Failed to create calendar event for "${title}":`, e)
      }
    }

    const uid = randomUUID()

    try {
      // Explicitly computed row rather than values.append, whose own "find the last row"
      // guess landed on an already-used row in testing and silently overwrote it.
      const nextRow = await getNextEmptyRow()
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `A${nextRow}:L${nextRow}`,
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
            photoDirectUrl,
            calendarEventId,
            calendarEventLink,
            uid,
          ]],
        },
      })
    } catch (e) {
      console.error(`[upcoming-events] Failed to save row (added by ${editorEmail}):`, e)
      res.status(502).json({ error: 'Failed to save the event to the sheet.' })
      return
    }

    upcomingEventsCache.fetchedAt = 0 // force the next GET to pick this up immediately
    console.info(`[upcoming-events] Event "${title}" added by ${editorEmail}`)

    res.status(201).json({
      event: {
        id: uid,
        startDate: parsedStartDate,
        endDate: parsedEndDate || undefined,
        title: String(title).trim(),
        description: String(description).trim(),
        category: String(category).trim(),
        kicker: categoryInfo.kicker,
        icon: categoryInfo.icon,
        image: photoDirectUrl || undefined,
        ticketed: parseYesNo(ticketed) || undefined,
        tbc: parseYesNo(tbc) || undefined,
        calendarEventId: calendarEventId || undefined,
        calendarEventLink: calendarEventLink || undefined,
      },
    })
  },
)

app.put(
  '/api/upcoming-events/:id',
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

    const uid = req.params.id
    const row = await findRowByUid(uid)
    if (row === null) {
      res.status(404).json({ error: 'Event not found — it may already have been edited or deleted elsewhere.' })
      return
    }

    const {
      title, description, category, startDate, endDate, ticketed, tbc,
      removePhoto, currentImageUrl, calendarEventId, calendarEventLink,
    } = req.body ?? {}
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

    const file = (req as any).file as { buffer: Buffer; mimetype: string; originalname: string } | undefined
    let photoDirectUrl = typeof currentImageUrl === 'string' ? currentImageUrl.trim() : ''
    if (file) {
      await deleteDriveFile(photoDirectUrl)
      photoDirectUrl = await uploadPhoto(file)
    } else if (parseYesNo(removePhoto)) {
      await deleteDriveFile(photoDirectUrl)
      photoDirectUrl = ''
    }

    let finalCalendarEventId = typeof calendarEventId === 'string' ? calendarEventId.trim() : ''
    let finalCalendarEventLink = typeof calendarEventLink === 'string' ? calendarEventLink.trim() : ''
    if (calendar && calendarId) {
      const body = buildCalendarEventBody(
        String(title).trim(),
        String(description).trim(),
        categoryInfo.kicker,
        editorEmail,
        parsedStartDate,
        parsedEndDate,
      )
      try {
        if (finalCalendarEventId) {
          const updatedEvent = await calendar.events.update({ calendarId, eventId: finalCalendarEventId, requestBody: body })
          // Backfills the link on rows edited before this column existed, since the link
          // never changes for a given event id/calendar and update() returns it for free.
          finalCalendarEventLink = updatedEvent.data.htmlLink ?? finalCalendarEventLink
        } else {
          const created = await calendar.events.insert({ calendarId, requestBody: body })
          finalCalendarEventId = created.data.id ?? ''
          finalCalendarEventLink = created.data.htmlLink ?? ''
        }
      } catch (e) {
        console.warn(`[upcoming-events] Calendar update failed for row ${row}, creating a fresh event instead:`, e)
        try {
          const created = await calendar.events.insert({ calendarId, requestBody: body })
          finalCalendarEventId = created.data.id ?? ''
          finalCalendarEventLink = created.data.htmlLink ?? ''
        } catch (e2) {
          console.error(`[upcoming-events] Calendar create fallback also failed for row ${row}:`, e2)
        }
      }
    }

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `A${row}:L${row}`,
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
            photoDirectUrl,
            finalCalendarEventId,
            finalCalendarEventLink,
            uid,
          ]],
        },
      })
    } catch (e) {
      console.error(`[upcoming-events] Failed to update row ${row} (by ${editorEmail}):`, e)
      res.status(502).json({ error: 'Failed to save changes to the sheet.' })
      return
    }

    upcomingEventsCache.fetchedAt = 0
    console.info(`[upcoming-events] Row ${row} ("${title}") updated by ${editorEmail}`)

    res.json({
      event: {
        id: uid,
        row,
        startDate: parsedStartDate,
        endDate: parsedEndDate || undefined,
        title: String(title).trim(),
        description: String(description).trim(),
        category: String(category).trim(),
        kicker: categoryInfo.kicker,
        icon: categoryInfo.icon,
        image: photoDirectUrl || undefined,
        ticketed: parseYesNo(ticketed) || undefined,
        tbc: parseYesNo(tbc) || undefined,
        calendarEventId: finalCalendarEventId || undefined,
        calendarEventLink: finalCalendarEventLink || undefined,
      },
    })
  },
)

app.delete('/api/upcoming-events/:id', async (req, res) => {
  const editorEmail = await verifyEditorEmail(req.headers.authorization)
  if (!editorEmail) {
    res.status(401).json({ error: 'Sign-in required or not authorized to add events.' })
    return
  }

  if (!sheets || !sheetConfigured) {
    res.status(503).json({ error: 'Events sheet is not configured on the server.' })
    return
  }

  const row = await findRowByUid(req.params.id)
  if (row === null) {
    res.status(404).json({ error: 'Event not found — it may already have been deleted.' })
    return
  }

  const { calendarEventId, imageUrl } = req.body ?? {}

  if (calendar && calendarId && typeof calendarEventId === 'string' && calendarEventId) {
    try {
      await calendar.events.delete({ calendarId, eventId: calendarEventId })
    } catch (e) {
      console.warn(`[upcoming-events] Failed to delete calendar event for row ${row} (continuing):`, e)
    }
  }

  if (typeof imageUrl === 'string' && imageUrl) {
    await deleteDriveFile(imageUrl)
  }

  const tabId = await getSheetTabId(sheetId!)
  if (tabId === null) {
    res.status(502).json({ error: 'Could not resolve the sheet to delete from.' })
    return
  }

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: { sheetId: tabId, dimension: 'ROWS', startIndex: row - 1, endIndex: row },
          },
        }],
      },
    })
  } catch (e) {
    console.error(`[upcoming-events] Failed to delete row ${row} (by ${editorEmail}):`, e)
    res.status(502).json({ error: 'Failed to delete the event from the sheet.' })
    return
  }

  upcomingEventsCache.fetchedAt = 0
  console.info(`[upcoming-events] Row ${row} deleted by ${editorEmail}`)
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

type BookingFields = {
  name: string
  email: string
  phone: string
  address?: string
  date: string
  startTime?: string
  endTime?: string
  eventType?: string
  attendees?: string | number
  exemption?: string
  notes?: string
  sendCopyToHirer?: boolean
  barOpenTime?: string
}

const BAR_NORMAL_OPEN_MINUTES = 19 * 60 // the bar normally opens at 7pm

function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

// Hours (rounded up) between a requested earlier bar-opening time and the normal 7pm
// opening — 0 if no time was requested, or the requested time isn't actually earlier.
function computeBarSurchargeHours(barOpenTime: string | undefined): number {
  if (!barOpenTime || !/^\d{1,2}:\d{2}$/.test(barOpenTime)) return 0
  const [h, m] = barOpenTime.split(':').map(Number)
  const diffMinutes = BAR_NORMAL_OPEN_MINUTES - (h * 60 + m)
  return diffMinutes > 0 ? Math.ceil(diffMinutes / 60) : 0
}

function computeAmountDue(exemption: string | undefined, barOpenTime: string | undefined) {
  const feeExempt = exemption === 'funeral' || exemption === 'charity'
  const feeAmount = feeExempt ? 0 : 2500
  const depositAmount = 3000
  const barSurchargeHours = computeBarSurchargeHours(barOpenTime)
  const barSurchargeAmount = barSurchargeHours * 1500
  return {
    feeExempt,
    feeAmount,
    depositAmount,
    barSurchargeHours,
    barSurchargeAmount,
    total: feeAmount + depositAmount + barSurchargeAmount,
  }
}

function formatAmountBreakdown(amounts: ReturnType<typeof computeAmountDue>, barOpenTime: string | undefined): string[] {
  const lines = [
    `Hire fee: ${amounts.feeExempt ? 'Waived' : formatPounds(amounts.feeAmount)}`,
    `Cleaning deposit: ${formatPounds(amounts.depositAmount)}`,
  ]
  if (amounts.barSurchargeAmount > 0) {
    const hourWord = amounts.barSurchargeHours === 1 ? 'hour' : 'hours'
    lines.push(
      `Bar opening surcharge: ${formatPounds(amounts.barSurchargeAmount)} (requested ${barOpenTime}, ${amounts.barSurchargeHours} ${hourWord} before the normal 7pm opening)`,
    )
  }
  lines.push(`Total: ${formatPounds(amounts.total)}`)
  return lines
}

function paymentStatusLine(paymentMethod: 'online' | 'in_person', paid: boolean, total: number): string {
  if (!paid) return `${formatPounds(total)} still owing — to be paid in person at the venue.`
  return paymentMethod === 'online'
    ? `${formatPounds(total)} received online via card (Stripe).`
    : `${formatPounds(total)} received in person.`
}

function buildBookingEventSummary(
  name: string,
  phone: string,
  reference: string,
  status: BookingStatus,
  paid: boolean,
): string {
  const tag = paid ? 'PAID' : 'AWAITING PAYMENT'
  const prefix = status === 'confirmed' ? '' : 'PROVISIONAL: '
  return `${prefix}${name} [${tag}] - ${phone} (Ref: ${reference})`
}

function buildBookingEventDescription(params: {
  reference: string
  paymentLine: string
  breakdownLines: string[]
  paymentIntentId?: string
  name: string
  email: string
  phone: string
  address?: string
  date: string
  startTime?: string
  endTime?: string
  eventType?: string
  attendees?: string | number
  exemption?: string
  notes?: string
}): string {
  const {
    reference, paymentLine, breakdownLines, paymentIntentId,
    name, email, phone, address, date, startTime, endTime, eventType, attendees, exemption, notes,
  } = params
  return `Provisional Booking Request
Reference: ${reference}

Payment: ${paymentLine}
${breakdownLines.map((line) => `  - ${line}`).join('\n')}${paymentIntentId ? `\n  - View payment in Stripe: ${stripePaymentDashboardUrl(paymentIntentId)}` : ''}

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
}

// ---- Bookings (Google Sheet, written to by the public booking flow and the admin tools) ----

type BookingStatus = 'provisional' | 'confirmed' | 'cancelled'

type BookingRecord = {
  reference: string // stable key, column B
  row?: number // current row at the time of the read; never trust this across requests
  status: BookingStatus
  paymentMethod: 'online' | 'in_person'
  paid: boolean
  date: string
  startTime: string
  endTime: string
  eventType: string
  attendees: string
  exemption: string
  barOpenTime: string
  notes: string
  name: string
  email: string
  phone: string
  address: string
  feeAmount: number
  depositAmount: number
  barSurchargeAmount: number
  total: number
  calendarEventId?: string
  calendarEventLink?: string
  paymentIntentId?: string
  createdBy: string
}

function parseBookingRow(row: string[]): Omit<BookingRecord, 'row'> | null {
  const [
    , reference, status, paymentMethod, paid, date, startTime, endTime,
    eventType, attendees, exemption, barOpenTime, notes, name, email, phone, address,
    feeAmount, depositAmount, barSurchargeAmount, total, calendarEventId, calendarEventLink, paymentIntentId, createdBy,
  ] = row
  if (!reference || !reference.trim()) return null

  return {
    reference: reference.trim(),
    status: status === 'confirmed' || status === 'cancelled' ? status : 'provisional',
    paymentMethod: paymentMethod === 'online' ? 'online' : 'in_person',
    paid: parseYesNo(paid),
    date: date ?? '',
    startTime: startTime ?? '',
    endTime: endTime ?? '',
    eventType: eventType ?? '',
    attendees: attendees ?? '',
    exemption: exemption && exemption.trim() ? exemption.trim() : 'none',
    barOpenTime: barOpenTime ?? '',
    notes: notes ?? '',
    name: name ?? '',
    email: email ?? '',
    phone: phone ?? '',
    address: address ?? '',
    feeAmount: Number(feeAmount) || 0,
    depositAmount: Number(depositAmount) || 0,
    barSurchargeAmount: Number(barSurchargeAmount) || 0,
    total: Number(total) || 0,
    calendarEventId: calendarEventId && calendarEventId.trim() ? calendarEventId.trim() : undefined,
    calendarEventLink: calendarEventLink && calendarEventLink.trim() ? calendarEventLink.trim() : undefined,
    paymentIntentId: paymentIntentId && paymentIntentId.trim() ? paymentIntentId.trim() : undefined,
    createdBy: createdBy && createdBy.trim() ? createdBy.trim() : 'website',
  }
}

function parseBookingRows(rows: string[][]): BookingRecord[] {
  const bookings: BookingRecord[] = []
  rows.forEach((row, index) => {
    const parsed = parseBookingRow(row)
    if (parsed) bookings.push({ ...parsed, row: index + 2 })
  })
  return bookings
}

function bookingRowValues(b: {
  reference: string
  status: BookingStatus
  paymentMethod: 'online' | 'in_person'
  paid: boolean
  date: string
  startTime: string
  endTime: string
  eventType: string
  attendees: string | number | undefined
  exemption: string
  barOpenTime: string
  notes: string
  name: string
  email: string
  phone: string
  address: string
  feeAmount: number
  depositAmount: number
  barSurchargeAmount: number
  total: number
  calendarEventId: string
  calendarEventLink: string
  paymentIntentId: string
  createdBy: string
}): string[] {
  return [
    new Date().toISOString(),
    b.reference,
    b.status,
    b.paymentMethod,
    b.paid ? 'Yes' : 'No',
    b.date,
    b.startTime,
    b.endTime,
    b.eventType,
    String(b.attendees ?? ''),
    b.exemption || 'none',
    b.barOpenTime,
    b.notes,
    b.name,
    b.email,
    b.phone,
    b.address,
    String(b.feeAmount),
    String(b.depositAmount),
    String(b.barSurchargeAmount),
    String(b.total),
    b.calendarEventId,
    b.calendarEventLink,
    b.paymentIntentId,
    b.createdBy,
  ]
}

// Finds the row currently holding the given reference (column B) with a fresh read — never
// trusts a row number from an earlier request, since rows shift after any delete — and
// returns it already parsed, since every admin action needs both.
async function getBookingByReference(reference: string): Promise<{ row: number; booking: BookingRecord } | null> {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: bookingsSheetId, range: 'A:Y' })
    const rows: string[][] = response.data.values || []
    const index = rows.findIndex((row) => (row[1] ?? '').trim() === reference)
    if (index === -1) return null
    const parsed = parseBookingRow(rows[index])
    if (!parsed) return null
    return { row: index + 1, booking: { ...parsed, row: index + 1 } } // rows[] is 0-indexed from row 1 (the header)
  } catch (e) {
    console.error(`[bookings] Failed to look up booking ${reference}:`, e)
    return null
  }
}

async function getNextEmptyBookingRow(): Promise<number> {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: bookingsSheetId, range: 'A:A' })
  const rows: string[][] = response.data.values || []
  return rows.length + 1
}

// Shared by the in-person path (called directly) and the Stripe webhook (called once payment
// is confirmed) — this is the only place that actually creates the Calendar event and email.
async function createBookingRecord(
  fields: BookingFields,
  reference: string,
  paymentMethod: 'online' | 'in_person',
  options: {
    paymentIntentId?: string
    paid?: boolean
    createdBy?: string
    notifyCommittee?: boolean
    status?: BookingStatus
  } = {},
): Promise<void> {
  const {
    paymentIntentId,
    paid = paymentMethod === 'online',
    createdBy = 'website',
    notifyCommittee = true,
    status = 'provisional',
  } = options
  const { name, email, phone, address, date, startTime, endTime, eventType, attendees, exemption, notes, sendCopyToHirer, barOpenTime } = fields
  const amounts = computeAmountDue(exemption, barOpenTime)
  const breakdownLines = formatAmountBreakdown(amounts, barOpenTime)
  const paymentLine = paymentStatusLine(paymentMethod, paid, amounts.total)
  const paymentStatusTag = paid ? 'PAID' : 'AWAITING PAYMENT'

  console.info('[booking]', {
    reference, name, email, phone, address, date,
    startTime, endTime, eventType, attendees, exemption, notes, barOpenTime, paymentMethod, paid, createdBy,
    amountDue: amounts.total,
  })

  let htmlLink = ''
  let calendarEventId = ''
  if (calendar && calendarId) {
    try {
      const eventSummary = buildBookingEventSummary(name, phone, reference, status, paid)
      const eventDescription = buildBookingEventDescription({
        reference, paymentLine, breakdownLines, paymentIntentId,
        name, email, phone, address, date, startTime, endTime, eventType, attendees, exemption, notes,
      })
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
      calendarEventId = calendarRes.data.id || ''
      console.log(`[booking] Google Calendar event created: ${htmlLink}`)
    } catch (e) {
      console.error('[booking] Failed to create Google Calendar event:', e)
    }
  } else {
    console.warn('[booking] Google Calendar integration not configured or initialized.')
  }

  // Send email via Resend
  if (notifyCommittee && emailConfigured && resend) {
    try {
      const recipient = process.env.NOTIFICATION_EMAIL_TO || 'merriottsocialvenue@gmail.com'
      const fromAddress = process.env.EMAIL_FROM || 'bookings@merriottsocialvenue.co.uk'

      const calendarLinkSection = htmlLink
        ? `<p><strong>Google Calendar Event Link:</strong> <a href="${htmlLink}">${htmlLink}</a></p>`
        : '<p><em>Note: Google Calendar event link could not be generated.</em></p>'

      const paymentLinkSection = paymentIntentId
        ? `<p><strong>View payment in Stripe:</strong> <a href="${stripePaymentDashboardUrl(paymentIntentId)}">${stripePaymentDashboardUrl(paymentIntentId)}</a></p>`
        : ''

      const recipients = Array.isArray(recipient) ? [...recipient] : [recipient]
      if (sendCopyToHirer && email && !recipients.includes(email)) {
        recipients.push(email)
      }

      const { error } = await resend.emails.send({
        from: fromAddress,
        to: recipients,
        subject: `Provisional Booking Request: ${name} [${paymentStatusTag}] (Ref: ${reference})`,
        html: `
          <h2>New Provisional Booking Request</h2>
          <p>A new request has been submitted with reference <strong>${reference}</strong>.</p>

          <p><strong>Payment:</strong> ${paymentLine}</p>
          <ul>
            ${breakdownLines.map((line) => `<li>${line}</li>`).join('\n            ')}
          </ul>

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
          ${paymentLinkSection}

          <p>Please check the calendar, then get in touch with the hirer to confirm${!paid ? ' and take payment' : ''}.</p>
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
  } else if (notifyCommittee) {
    console.warn('[booking] Resend not configured. Notification email skipped.')
  }

  if (sheets && bookingsSheetConfigured) {
    try {
      const nextRow = await getNextEmptyBookingRow()
      await sheets.spreadsheets.values.update({
        spreadsheetId: bookingsSheetId,
        range: `A${nextRow}:Y${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [bookingRowValues({
            reference,
            status,
            paymentMethod,
            paid,
            date,
            startTime: startTime || '',
            endTime: endTime || '',
            eventType: eventType || '',
            attendees,
            exemption: exemption || 'none',
            barOpenTime: barOpenTime || '',
            notes: notes || '',
            name,
            email,
            phone,
            address: address || '',
            feeAmount: amounts.feeAmount,
            depositAmount: amounts.depositAmount,
            barSurchargeAmount: amounts.barSurchargeAmount,
            total: amounts.total,
            calendarEventId,
            calendarEventLink: htmlLink,
            paymentIntentId: paymentIntentId || '',
            createdBy,
          })],
        },
      })
    } catch (e) {
      // Best-effort: the Calendar event and email (the parts that actually reach the hirer
      // and committee) already succeeded, so a sheet outage shouldn't fail the booking.
      console.error(`[bookings] Failed to save booking ${reference} to the sheet (continuing):`, e)
    }
  }
}

app.post('/api/bookings', async (req, res) => {
  const {
    name,
    email,
    phone,
    middleName,
    address,
    date,
    slotType,
    startTime,
    endTime,
    eventType,
    attendees,
    exemption,
    declaration,
    notes,
    sendCopyToHirer,
    paymentMethod,
    barOpenTime,
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

  if (paymentMethod !== 'online' && paymentMethod !== 'in_person') {
    res.status(400).json({ error: 'Please choose how you will pay: online now, or in person at the venue.' })
    return
  }

  const reference = `MSV-${Date.now().toString(36).toUpperCase()}`
  const fields: BookingFields = {
    name, email, phone, address, date, startTime, endTime, eventType, attendees, exemption, notes,
    sendCopyToHirer: Boolean(sendCopyToHirer),
    barOpenTime: barOpenTime || undefined,
  }

  if (paymentMethod === 'in_person') {
    await createBookingRecord(fields, reference, 'in_person')
    res.json({ ok: true, reference })
    return
  }

  if (!stripe) {
    res.status(503).json({ error: 'Online payment is not configured on the server yet. Please choose to pay in person instead.' })
    return
  }

  const amounts = computeAmountDue(exemption, barOpenTime)

  try {
    const siteOrigin = webOrigins[0] || 'https://merriottsocialvenue.co.uk'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: amounts.total,
          product_data: {
            name: 'Merriott Social Venue — Function Room Hire Fee & Cleaning Deposit',
            description: `${date} — ${eventType || 'Function room hire'} (Ref: ${reference})`,
          },
        },
        quantity: 1,
      }],
      customer_email: email,
      // The app uses HashRouter, so the route must be in the fragment (#/book), not the path,
      // or the browser lands on a plain /book URL that HashRouter can't match and Home renders instead.
      success_url: `${siteOrigin}/#/book?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteOrigin}/#/book`,
      metadata: {
        reference,
        amountDue: String(amounts.total),
        name,
        email,
        phone,
        address: address || '',
        date,
        slotType: slotType || '',
        startTime: startTime || '',
        endTime: endTime || '',
        eventType: eventType || '',
        attendees: String(attendees ?? ''),
        exemption: exemption || 'none',
        notes: String(notes || '').slice(0, 450),
        sendCopyToHirer: sendCopyToHirer ? 'yes' : 'no',
        barOpenTime: barOpenTime || '',
      },
    })
    res.json({ ok: true, url: session.url })
  } catch (e) {
    console.error('[bookings] Failed to create Stripe checkout session:', e)
    res.status(502).json({ error: 'Could not start payment. Please try again.' })
  }
})

app.get('/api/bookings/checkout-session/:sessionId', async (req, res) => {
  if (!stripe) {
    res.status(503).json({ error: 'Online payment is not configured on the server.' })
    return
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId)
    if (session.payment_status !== 'paid') {
      res.status(402).json({ error: 'Payment has not been completed for this booking.' })
      return
    }
    res.json({ booking: session.metadata })
  } catch (e) {
    console.error('[bookings] Failed to retrieve checkout session:', e)
    res.status(404).json({ error: 'Booking session not found.' })
  }
})

// Guards against Stripe retrying a webhook delivery and creating a duplicate booking.
const processedCheckoutSessions = new Set<string>()

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    res.status(503).send('Stripe not configured')
    return
  }

  let event: Stripe.Event
  try {
    const signature = req.headers['stripe-signature']
    event = stripe.webhooks.constructEvent(req.body, signature as string, stripeWebhookSecret)
  } catch (e) {
    console.error('[stripe] Webhook signature verification failed:', e)
    res.status(400).send('Invalid signature')
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    if (!processedCheckoutSessions.has(session.id)) {
      processedCheckoutSessions.add(session.id)
      const metadata = session.metadata ?? {}
      const fields: BookingFields = {
        name: metadata.name ?? '',
        email: metadata.email ?? '',
        phone: metadata.phone ?? '',
        address: metadata.address,
        date: metadata.date ?? '',
        startTime: metadata.startTime,
        endTime: metadata.endTime,
        eventType: metadata.eventType,
        attendees: metadata.attendees,
        exemption: metadata.exemption,
        notes: metadata.notes,
        sendCopyToHirer: metadata.sendCopyToHirer === 'yes',
        barOpenTime: metadata.barOpenTime || undefined,
      }
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
      await createBookingRecord(fields, metadata.reference ?? session.id, 'online', { paymentIntentId })
      console.info(`[bookings] Booking ${metadata.reference} created from paid Stripe session ${session.id}`)
    }
  }

  res.json({ received: true })
})

// ---- Admin: manage bookings (create/edit/confirm/cancel) ----

app.get('/api/admin/bookings', async (req, res) => {
  const editorEmail = await verifyEditorEmail(req.headers.authorization)
  if (!editorEmail) {
    res.status(401).json({ error: 'Sign-in required or not authorized to manage bookings.' })
    return
  }
  if (!sheets || !bookingsSheetConfigured) {
    res.json({ sheetConfigured: false, bookings: [] })
    return
  }

  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: bookingsSheetId, range: bookingsSheetRange })
    const bookings = parseBookingRows(response.data.values || [])
    res.json({ sheetConfigured: true, bookings })
  } catch (e) {
    console.error('[bookings] Failed to load bookings sheet:', e)
    res.status(502).json({ error: 'Failed to load bookings.' })
  }
})

app.post('/api/admin/bookings', async (req, res) => {
  const editorEmail = await verifyEditorEmail(req.headers.authorization)
  if (!editorEmail) {
    res.status(401).json({ error: 'Sign-in required or not authorized to manage bookings.' })
    return
  }

  const {
    name, email, phone, address, date, startTime, endTime, eventType, attendees,
    exemption, notes, barOpenTime, paymentMethod, paid, confirmed,
  } = req.body ?? {}

  if (!name || !email || !phone || !date) {
    res.status(400).json({ error: 'name, email, phone, and date are required.' })
    return
  }
  if (paymentMethod !== 'online' && paymentMethod !== 'in_person') {
    res.status(400).json({ error: 'paymentMethod must be "online" or "in_person".' })
    return
  }

  const reference = `MSV-${Date.now().toString(36).toUpperCase()}`
  const fields: BookingFields = {
    name, email, phone, address, date, startTime, endTime, eventType, attendees, exemption, notes,
    sendCopyToHirer: false,
    barOpenTime: barOpenTime || undefined,
  }

  await createBookingRecord(fields, reference, paymentMethod, {
    paid: Boolean(paid),
    createdBy: editorEmail,
    notifyCommittee: false,
    status: confirmed ? 'confirmed' : 'provisional',
  })

  console.info(`[bookings] ${reference} created directly by admin ${editorEmail}`)
  res.status(201).json({ ok: true, reference })
})

app.put('/api/admin/bookings/:reference', async (req, res) => {
  const editorEmail = await verifyEditorEmail(req.headers.authorization)
  if (!editorEmail) {
    res.status(401).json({ error: 'Sign-in required or not authorized to manage bookings.' })
    return
  }
  if (!sheets || !bookingsSheetConfigured) {
    res.status(503).json({ error: 'Bookings sheet is not configured on the server.' })
    return
  }

  // Exemption and bar-opening time determine the price, so editing is refused if either is
  // present — the UI never sends them, but the server enforces it independently too.
  if (req.body && ('exemption' in req.body || 'barOpenTime' in req.body)) {
    res.status(400).json({
      error: "Exemption status and bar-opening time can't be edited — they determine the price. Cancel and create a new booking instead.",
    })
    return
  }

  const reference = req.params.reference
  const found = await getBookingByReference(reference)
  if (!found) {
    res.status(404).json({ error: 'Booking not found — it may already have been cancelled elsewhere.' })
    return
  }
  const { row, booking: existing } = found

  const { name, email, phone, address, date, startTime, endTime, eventType, attendees, notes, confirmed } = req.body ?? {}
  if (!name || !email || !phone || !date) {
    res.status(400).json({ error: 'name, email, phone, and date are required.' })
    return
  }

  // A cancelled booking can't be resurrected through edit; otherwise let the form's
  // "Confirmed" checkbox move the booking between provisional and confirmed. If the field
  // is omitted entirely (an older client), leave the current status untouched.
  const newStatus: BookingStatus =
    existing.status === 'cancelled' ? 'cancelled' : confirmed === undefined ? existing.status : confirmed ? 'confirmed' : 'provisional'

  const updated: Omit<BookingRecord, 'row'> = {
    reference: existing.reference,
    status: newStatus,
    paymentMethod: existing.paymentMethod,
    paid: existing.paid,
    exemption: existing.exemption,
    barOpenTime: existing.barOpenTime,
    feeAmount: existing.feeAmount,
    depositAmount: existing.depositAmount,
    barSurchargeAmount: existing.barSurchargeAmount,
    total: existing.total,
    calendarEventId: existing.calendarEventId,
    calendarEventLink: existing.calendarEventLink,
    paymentIntentId: existing.paymentIntentId,
    createdBy: existing.createdBy,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    address: address ? String(address).trim() : '',
    date: String(date),
    startTime: startTime ? String(startTime) : '',
    endTime: endTime ? String(endTime) : '',
    eventType: eventType ? String(eventType).trim() : '',
    attendees: attendees !== undefined && attendees !== null ? String(attendees) : existing.attendees,
    notes: notes ? String(notes).trim() : '',
  }

  if (calendar && calendarId && existing.calendarEventId) {
    try {
      const amounts = computeAmountDue(existing.exemption, existing.barOpenTime)
      const breakdownLines = formatAmountBreakdown(amounts, existing.barOpenTime)
      const paymentLine = paymentStatusLine(existing.paymentMethod, existing.paid, existing.total)
      await calendar.events.update({
        calendarId,
        eventId: existing.calendarEventId,
        requestBody: {
          summary: buildBookingEventSummary(updated.name, updated.phone, reference, newStatus, existing.paid),
          description: buildBookingEventDescription({
            reference, paymentLine, breakdownLines, paymentIntentId: existing.paymentIntentId,
            name: updated.name, email: updated.email, phone: updated.phone, address: updated.address,
            date: updated.date, startTime: updated.startTime, endTime: updated.endTime, eventType: updated.eventType,
            attendees: updated.attendees, exemption: existing.exemption, notes: updated.notes,
          }),
          start: { dateTime: `${updated.date}T${updated.startTime || '00:00'}:00`, timeZone: 'Europe/London' },
          end: { dateTime: `${updated.date}T${updated.endTime || '00:00'}:00`, timeZone: 'Europe/London' },
        },
      })
    } catch (e) {
      console.error(`[bookings] Failed to update calendar event for ${reference} (continuing):`, e)
    }
  }

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: bookingsSheetId,
      range: `A${row}:Y${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [bookingRowValues({
          ...updated,
          calendarEventId: updated.calendarEventId || '',
          calendarEventLink: updated.calendarEventLink || '',
          paymentIntentId: updated.paymentIntentId || '',
        })],
      },
    })
  } catch (e) {
    console.error(`[bookings] Failed to save edits to ${reference} (by ${editorEmail}):`, e)
    res.status(502).json({ error: 'Failed to save changes to the sheet.' })
    return
  }

  console.info(`[bookings] ${reference} edited by ${editorEmail}`)
  res.json({ booking: { ...updated, row } })
})

app.post('/api/admin/bookings/:reference/confirm', async (req, res) => {
  const editorEmail = await verifyEditorEmail(req.headers.authorization)
  if (!editorEmail) {
    res.status(401).json({ error: 'Sign-in required or not authorized to manage bookings.' })
    return
  }
  if (!sheets || !bookingsSheetConfigured) {
    res.status(503).json({ error: 'Bookings sheet is not configured on the server.' })
    return
  }

  const reference = req.params.reference
  const found = await getBookingByReference(reference)
  if (!found) {
    res.status(404).json({ error: 'Booking not found — it may already have been cancelled elsewhere.' })
    return
  }
  const { row, booking: existing } = found

  if (existing.status === 'cancelled') {
    res.status(400).json({ error: "This booking has been cancelled and can't be confirmed." })
    return
  }

  if (calendar && calendarId && existing.calendarEventId) {
    try {
      await calendar.events.patch({
        calendarId,
        eventId: existing.calendarEventId,
        requestBody: {
          summary: buildBookingEventSummary(existing.name, existing.phone, reference, 'confirmed', existing.paid),
        },
      })
    } catch (e) {
      console.error(`[bookings] Failed to update calendar event for ${reference} (continuing):`, e)
    }
  }

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: bookingsSheetId,
      range: `A${row}:Y${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [bookingRowValues({
          ...existing,
          status: 'confirmed',
          calendarEventId: existing.calendarEventId || '',
          calendarEventLink: existing.calendarEventLink || '',
          paymentIntentId: existing.paymentIntentId || '',
        })],
      },
    })
  } catch (e) {
    console.error(`[bookings] Failed to save confirmation for ${reference} (by ${editorEmail}):`, e)
    res.status(502).json({ error: 'Failed to save the confirmation to the sheet.' })
    return
  }

  console.info(`[bookings] ${reference} confirmed by ${editorEmail}`)
  res.json({ booking: { ...existing, status: 'confirmed' } })
})

app.delete('/api/admin/bookings/:reference', async (req, res) => {
  const editorEmail = await verifyEditorEmail(req.headers.authorization)
  if (!editorEmail) {
    res.status(401).json({ error: 'Sign-in required or not authorized to manage bookings.' })
    return
  }
  if (!sheets || !bookingsSheetConfigured) {
    res.status(503).json({ error: 'Bookings sheet is not configured on the server.' })
    return
  }

  const reference = req.params.reference
  const found = await getBookingByReference(reference)
  if (!found) {
    res.status(404).json({ error: 'Booking not found — it may already have been cancelled elsewhere.' })
    return
  }
  const { row, booking: existing } = found

  // Best-effort: delete the Calendar event, but a failure here shouldn't block the
  // cancellation itself from being recorded.
  if (calendar && calendarId && existing.calendarEventId) {
    try {
      await calendar.events.delete({ calendarId, eventId: existing.calendarEventId })
    } catch (e) {
      console.warn(`[bookings] Failed to delete calendar event for ${reference} (continuing):`, e)
    }
  }

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: bookingsSheetId,
      range: `A${row}:Y${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [bookingRowValues({
          ...existing,
          status: 'cancelled',
          calendarEventId: existing.calendarEventId || '',
          calendarEventLink: existing.calendarEventLink || '',
          paymentIntentId: existing.paymentIntentId || '',
        })],
      },
    })
  } catch (e) {
    console.error(`[bookings] Failed to save cancellation for ${reference} (by ${editorEmail}):`, e)
    res.status(502).json({ error: 'Failed to save the cancellation to the sheet.' })
    return
  }

  // The booking stays on the sheet with status=cancelled (not removed) — it's the record
  // that flags a paid-online booking still needs a manual refund in the Stripe Dashboard.
  if (emailConfigured && resend && existing.email) {
    try {
      const fromAddress = process.env.EMAIL_FROM || 'bookings@merriottsocialvenue.co.uk'
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: existing.email,
        subject: `Your booking has been cancelled (Ref: ${reference})`,
        html: `
          <h2>Booking Cancelled</h2>
          <p>Hi ${existing.name || 'there'},</p>
          <p>Your provisional booking request for <strong>${existing.date}</strong>
          (Ref: <strong>${reference}</strong>) has been cancelled.</p>
          <p>If you have any questions, or if you believe this was a mistake, please get in
          touch with us at merriottsocialvenue@gmail.com or 07471 593040.</p>
        `,
      })
      if (error) {
        console.error(`[bookings] Failed to send cancellation email for ${reference}:`, error)
      } else {
        console.log(`[bookings] Cancellation email sent to ${existing.email} for ${reference}`)
      }
    } catch (e) {
      console.error(`[bookings] Failed to send cancellation email for ${reference}:`, e)
    }
  }

  console.info(`[bookings] ${reference} cancelled by ${editorEmail}`)
  res.json({ ok: true })
})

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(port, '0.0.0.0', function () {
  console.log(`API listening on http://localhost:${port}`)
})