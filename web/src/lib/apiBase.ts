export function getApiBase(): string {
  const env = import.meta.env.VITE_API_URL
  if (env && env.length > 0) return env.replace(/\/$/, '')
  return ''
}

export function apiUrl(path: string): string {
  const base = getApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  if (base) return `${base}${p}`
  return p
}
