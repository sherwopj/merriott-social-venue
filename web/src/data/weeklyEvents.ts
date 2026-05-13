import mondayBingo from '../assets/weekly-events/monday_bingoPoster.png'
import sundayQuiz from '../assets/weekly-events/sunday_quizNight.png'
import tuesdayKarate from '../assets/weekly-events/tuesday_learnKarate.png'
import tuesdaySkittles from '../assets/weekly-events/tuesday_skittles_league.jpg'
import wednesdayPool from '../assets/weekly-events/wednesday_freePoolWednesdays.png'
import wednesdayOpenMic from '../assets/weekly-events/wednesday_openMic_monthly_3rd_wednesday.png'
import thursdayKarate from '../assets/weekly-events/thursday_learnKarate.png'
import thursdaySkittles from '../assets/weekly-events/thursday_skittles_league.jpg'

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
  note?: string
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

export const weeklyEvents: Record<Weekday, WeekdayEvent[] | null> = {
  monday: [
    {
      title: 'Bingo Night',
      description: 'Eyes down! Join us for a fun evening of Bingo with great prizes.',
      image: mondayBingo,
    },
  ],
  tuesday: [
    {
      title: 'Learn Karate',
      description: 'Martial arts classes for all ages and skill levels.',
      image: tuesdayKarate,
    },
    {
      title: 'Skittles League',
      description: 'Local league matches. Come and support the home team!',
      image: tuesdaySkittles,
    },
  ],
  wednesday: [
    {
      title: 'Free Pool Wednesdays',
      description: 'Enjoy a few frames of pool on the house all evening.',
      image: wednesdayPool,
    },
    {
      title: 'Open Mic Night',
      description: 'Show off your talent or just enjoy the local acts.',
      image: wednesdayOpenMic,
      note: 'Happens once per month (usually 3rd Wednesday)',
    },
  ],
  thursday: [
    {
      title: 'Learn Karate',
      description: 'Martial arts classes for all ages and skill levels.',
      image: thursdayKarate,
    },
    {
      title: 'Skittles League',
      description: 'Local league matches. Come and support the home team!',
      image: thursdaySkittles,
    },
  ],
  friday: null,
  saturday: null,
  sunday: [
    {
      title: 'Quiz Night',
      description: 'Test your knowledge! Teams of up to six, arrive 7:30pm for 8:00pm start.',
      image: sundayQuiz,
    },
  ],
}
