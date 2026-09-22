import type { IconName } from '../components/EventIcon'

// To attach a real photo to an event (instead of its icon badge), import it the same way
// weeklyEvents.ts does, e.g.:
//   import barryPaulElvis from '../assets/upcoming-events/barry-paul-elvis.jpg'
// then set `image: barryPaulElvis` on that entry below. No other code changes are needed —
// the events list automatically shows the photo instead of the icon when `image` is set.

export type UpcomingEvent = {
  id: string
  row?: number // sheet row number; present on live/API data, absent on the bundled fallback
  startDate: string // 'YYYY-MM-DD'
  endDate?: string // for multi-day entries
  title: string
  description: string
  category?: string // raw category string, used to pre-fill an edit form's dropdown
  kicker: string
  icon: IconName
  image?: string
  ticketed?: boolean
  tbc?: boolean
  calendarEventId?: string
  calendarEventLink?: string
  room?: 'MSV Function Room' | 'MSV Front Bar'
}

export const upcomingEvents: UpcomingEvent[] = [
  {
    id: 'volunteer-days-2026-10',
    startDate: '2026-10-02',
    endDate: '2026-10-03',
    title: 'Volunteer Days',
    description: 'Help us get the venue ready. All volunteers welcome, no experience needed.',
    kicker: 'Community',
    icon: 'handsHeart',
  },
  {
    id: 'halloween-family-disco-2026',
    startDate: '2026-10-31',
    title: 'Halloween Family Disco',
    description: 'Fancy dress family disco with DJ Paul-Claude.',
    kicker: 'Disco Night',
    icon: 'discoBall',
  },
  {
    id: 'christmas-with-elvis-2026',
    startDate: '2026-12-11',
    title: 'Christmas With Elvis',
    description: 'Live Elvis tribute show performed by Barry Paul.',
    kicker: 'Tribute Show',
    icon: 'starMic',
  },
  {
    id: 'nye-disco-2026',
    startDate: '2026-12-31',
    title: "New Year's Eve Disco",
    description: "See in the New Year with DJ Fejz Soundsystem.",
    kicker: 'Disco Night',
    icon: 'discoBall',
  },
  {
    id: 'valentines-rocknroll-2027',
    startDate: '2027-02-13',
    title: "1950s Rock 'n' Roll Valentine's Dance",
    description: 'DJ The Big Bald Bopper spins the 1950s classics.',
    kicker: 'DJ Night',
    icon: 'vinylRecord',
  },
  {
    id: 'ska-kives-2027',
    startDate: '2027-03-06',
    title: 'Live Band: Ska Kives',
    description: 'A night of live ska with Ska Kives.',
    kicker: 'Live Band',
    icon: 'guitarBand',
  },
  {
    id: 'motown-soul-60s-2027',
    startDate: '2027-04-03',
    title: 'Motown & Soul 60s Night',
    description: 'DJ Roger plays Motown and soul classics.',
    kicker: 'DJ Night',
    icon: 'vinylRecord',
  },
  {
    id: 've-day-street-party-2027',
    startDate: '2027-05-08',
    title: 'VE Day Street Party BBQ',
    description:
      '1940s-themed street party BBQ with singer Gemma Ruby, followed by an evening with DJ Fejz Soundsystem.',
    kicker: 'Celebration',
    icon: 'bbqFlag',
  },
  {
    id: 'the-helm-2027',
    startDate: '2027-06-05',
    title: 'Live Band: The Helm',
    description: 'A night of live music with The Helm.',
    kicker: 'Live Band',
    icon: 'guitarBand',
  },
  {
    id: 'bella-bluebell-drag-show-2027',
    startDate: '2027-07-03',
    title: 'Bella Bluebell Drag Show',
    description: 'A ticketed cabaret evening with Bella Bluebell.',
    kicker: 'Cabaret Show',
    icon: 'feathers',
    ticketed: true,
  },
  {
    id: 'full-on-90s-2027',
    startDate: '2027-08-07',
    title: 'Full-On 90s Night',
    description: 'DJ Roger plays the best of the 90s.',
    kicker: 'DJ Night',
    icon: 'vinylRecord',
  },
  {
    id: 'reformers-70s-80s-2027',
    startDate: '2027-09-04',
    title: '70s & 80s Night: The Reformers',
    description: 'Live band The Reformers bring the best of the 70s and 80s.',
    kicker: 'Live Band',
    icon: 'guitarBand',
  },
  {
    id: 'voulez-vous-abba-2027',
    startDate: '2027-10-02',
    title: 'Voulez-Vous: ABBA Tribute',
    description: 'A live tribute to ABBA.',
    kicker: 'Tribute Show',
    icon: 'starMic',
  },
  {
    id: 'halloween-disco-2027',
    startDate: '2027-10-30',
    title: 'Halloween Disco',
    description: "DJ Roger's Halloween disco night.",
    kicker: 'Disco Night',
    icon: 'discoBall',
  },
  {
    id: 'drum-and-bass-2027',
    startDate: '2027-11-06',
    title: 'Drum & Bass Party',
    description: 'A drum & bass night with DJ Fejz Soundsystem.',
    kicker: 'DJ Night',
    icon: 'vinylRecord',
  },
  {
    id: 'christmas-2027',
    startDate: '2027-12-04',
    title: 'Christmas With…',
    description: 'Details to be confirmed — check back soon!',
    kicker: 'Celebration',
    icon: 'santaHat',
    tbc: true,
  },
]
