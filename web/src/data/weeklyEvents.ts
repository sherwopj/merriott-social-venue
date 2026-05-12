export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export type WeekdayEvent = {
  title: string
  description: string
  image: string
}

export const weekdayOrder: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const weekdayLabels: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export const weeklyEvents: Record<Weekday, WeekdayEvent | null> = {
  monday: {
    title: 'Members’ night',
    description:
      'Relaxed evening in the bar — pool, darts, and good company. New faces always welcome.',
    image: '/events/placeholder.svg',
  },
  tuesday: null,
  wednesday: {
    title: 'Quiz night',
    description:
      'Teams of up to six. Small entry fee with prizes. Arrive from 7:30pm for an 8:00pm start.',
    image: '/events/placeholder.svg',
  },
  thursday: null,
  friday: {
    title: 'Live music (monthly)',
    description:
      'Check the notice board for this month’s date. Dancing optional, enjoyment guaranteed.',
    image: '/events/placeholder.svg',
  },
  saturday: {
    title: 'Sports on screen',
    description:
      'Key matches on the big screen when schedules allow. Family-friendly until late afternoon.',
    image: '/events/placeholder.svg',
  },
  sunday: {
    title: 'Sunday social',
    description:
      'Quiet pints and papers from midday. A proper end to the week in Merriott.',
    image: '/events/placeholder.svg',
  },
}
