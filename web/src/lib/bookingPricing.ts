export const EXEMPTION_LABELS: Record<string, string> = {
  none: 'None – Regular Hire (£25)',
  adult_evening: 'Adult evening event (30+ bar users)',
  funeral: 'Funeral / Wake',
  charity: 'Charity Event',
}

const BAR_NORMAL_OPEN_MINUTES = 19 * 60 // the bar normally opens at 7pm

// Hours (rounded up) of early bar opening requested — only the portion of the requested
// barOpenTime–barCloseTime range that falls before the bar's normal 7pm opening is charged,
// so a request that runs past 7pm is capped there rather than billing normal hours too.
export function computeBarSurchargeHours(barOpenTime: string, barCloseTime: string) {
  if (!barOpenTime) return 0
  const [sh, sm] = barOpenTime.split(':').map(Number)
  const startMinutes = sh * 60 + sm
  if (startMinutes >= BAR_NORMAL_OPEN_MINUTES) return 0

  let endMinutes = BAR_NORMAL_OPEN_MINUTES
  if (barCloseTime) {
    const [eh, em] = barCloseTime.split(':').map(Number)
    endMinutes = Math.min(eh * 60 + em, BAR_NORMAL_OPEN_MINUTES)
  }

  const diffMinutes = endMinutes - startMinutes
  return diffMinutes > 0 ? Math.ceil(diffMinutes / 60) : 0
}

export function computeAmountBreakdown(exemption: string, barOpenTime: string, barCloseTime: string) {
  const feeExempt = exemption === 'funeral' || exemption === 'charity'
  const feeAmount = feeExempt ? 0 : 25
  const depositAmount = 30
  const barSurchargeHours = computeBarSurchargeHours(barOpenTime, barCloseTime)
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
