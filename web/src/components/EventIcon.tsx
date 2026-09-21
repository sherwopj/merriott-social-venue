import type { ReactElement } from 'react'

export type IconName =
  | 'handsHeart'
  | 'discoBall'
  | 'starMic'
  | 'vinylRecord'
  | 'guitarBand'
  | 'bbqFlag'
  | 'santaHat'
  | 'feathers'

const icons: Record<IconName, ReactElement> = {
  handsHeart: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 13c-2.2 1.4-4 3.4-4 5.5" />
      <path d="M17 13c2.2 1.4 4 3.4 4 5.5" />
      <path d="M4 18.5c0 1.4 1.8 2.5 4 2.5h8c2.2 0 4-1.1 4-2.5" />
      <path
        d="M12 9.6c-1-1.5-2.6-2.6-4-2.6-1.8 0-3 1.3-3 2.9 0 2.2 3 4 7 6.6 4-2.6 7-4.4 7-6.6 0-1.6-1.2-2.9-3-2.9-1.4 0-3 1.1-4 2.6z"
        fill="currentColor"
        stroke="none"
      />
    </g>
  ),
  discoBall: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="7" />
      <path d="M5 12h14M12 5v14" />
      <path d="M7.1 7.1l9.8 9.8M16.9 7.1l-9.8 9.8" />
      <path d="M12 3v1.6M12 19.4V21" />
    </g>
  ),
  starMic: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9.5" y="3" width="5" height="9" rx="2.5" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v3.2" />
      <path d="M9 20.5h6" />
      <path
        d="M17.5 6.2l.5 1.1 1.2.15-.9.85.25 1.2-1.05-.6-1.05.6.25-1.2-.9-.85 1.2-.15z"
        fill="currentColor"
        stroke="none"
      />
    </g>
  ),
  vinylRecord: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9 5.3a8 8 0 0 0-3.7 3.7" opacity="0.5" />
      <path d="M18.7 15a8 8 0 0 1-3.7 3.7" opacity="0.5" />
    </g>
  ),
  guitarBand: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 3.5L9 9" />
      <rect x="6.3" y="9" width="4" height="4" rx="0.6" transform="rotate(-45 8.3 11)" />
      <circle cx="8.2" cy="15.8" r="4.2" />
      <circle cx="8.2" cy="15.8" r="1.6" />
      <path d="M15 4l1.4-1.4M17 6l1.4-1.4M13 2l1.4 1.4" opacity="0.6" />
    </g>
  ),
  bbqFlag: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21v-9.5" />
      <path d="M12 11.5c-3.5 0-5-2-5-4.3C7 5 8.6 3.3 10.3 4c-.7 1.4.1 2.6 1.7 2.6S13.7 4.9 13 3.5C14.9 3.1 17 4.8 17 7.2c0 2.3-1.5 4.3-5 4.3z" />
      <path d="M8.3 21h7.4" />
    </g>
  ),
  santaHat: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17c0-5 3-10.5 8-11.5" />
      <path d="M13 5.5c4 .6 6.5 4 6 8-3-1.4-6.4-1-9.3.6" />
      <path d="M4.3 17.2c4.6-2.3 10-2.7 14.6-.6" />
      <circle cx="18.7" cy="5.3" r="1.6" fill="currentColor" stroke="none" />
      <path d="M3.7 19.8c1.8-1.2 3.6-1.9 5.4-2.1" opacity="0" />
      <rect x="3.3" y="17.4" width="17.4" height="2.8" rx="1.4" />
    </g>
  ),
  feathers: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21c-1-4 .5-9 4-13" />
      <path d="M12 8c-1.6-.6-2.8-2-3-4 2 .3 3.4 1.4 4 3" />
      <path d="M13.3 6.4c-.9-1.6-.9-3.2-.2-4.9 1.8 1 2.7 2.5 2.6 4.4" />
      <path d="M10.7 10.7c-1.7-.2-3.1-1.2-3.9-3 2-.4 3.6.2 4.6 1.6" />
      <path d="M16 21c1-4-.5-9-4-13" />
    </g>
  ),
}

export function EventIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      {icons[name]}
    </svg>
  )
}
