// Thrown internally by adminFetch when the session has expired — callers should let it
// propagate to their catch block and treat it as "already handled, nothing to show" (the
// 401 branch has already called onCredentialInvalid to prompt a fresh sign-in).
export class SessionExpiredError extends Error {}

// Wraps fetch for authenticated admin API calls: on a 401 it notifies the caller and throws
// SessionExpiredError, on any other non-ok response it throws an Error built from the
// response body's `error` field (or a generic fallback). Callers still call res.json()
// themselves for the successful-response body.
export async function adminFetch(input: string, init: RequestInit, onCredentialInvalid: () => void): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401) {
    onCredentialInvalid()
    throw new SessionExpiredError()
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return res
}
