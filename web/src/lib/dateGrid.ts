export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}
