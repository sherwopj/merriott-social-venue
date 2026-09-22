export const EXEMPTION_LABELS: Record<string, string> = {
  none: 'None – Regular Hire (£25)',
  adult_evening: 'Adult evening event (30+ bar users)',
  funeral: 'Funeral / Wake',
  charity: 'Charity Event',
}

// Hours (rounded up) between a requested earlier bar-opening time and the normal 7pm
// opening — 0 if no time was requested, or the requested time isn't actually earlier.
export function computeBarSurchargeHours(barOpenTime: string) {
  if (!barOpenTime) return 0
  const [h, m] = barOpenTime.split(':').map(Number)
  const diffMinutes = 19 * 60 - (h * 60 + m)
  return diffMinutes > 0 ? Math.ceil(diffMinutes / 60) : 0
}

export function computeAmountBreakdown(exemption: string, barOpenTime: string) {
  const feeExempt = exemption === 'funeral' || exemption === 'charity'
  const feeAmount = feeExempt ? 0 : 25
  const depositAmount = 30
  const barSurchargeHours = computeBarSurchargeHours(barOpenTime)
  const barSurchargeAmount = barSurchargeHours * 15
  return {
    feeExempt,
    feeAmount,
    depositAmount,
    barSurchargeHours,
    barSurchargeAmount,
    total: feeAmount + depositAmount + barSurchargeAmount,
  }
}
