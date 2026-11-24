/**
 * web-bff session: the browser holds only an HttpOnly cookie; this module keeps the CSRF
 * token every write sends (`X-CSRF-Token`). `GET /bff/session` creates a guest session; a
 * customer logs in with `customerLogin` (checked by customer-service — not the Studio login).
 */
import { EMPTY_CATALOG, type AppCatalog } from '../sdui/config'

let csrf: string | undefined
let user: string | undefined

/** a logged-in customer */
export interface Customer { user: string; name: string }
/** a simulated activity (the same list for everyone) and the insight page it brings up */
export interface Activity { code: string; title: string; description: string; page: string }
/** an insight on the dashboard, with this customer's vote ('' = none yet) */
export interface Insight { activity: string; page: string; title: string; vote: '' | 'like' | 'dislike' }

export class BffError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET') headers['X-CSRF-Token'] = (await session()).csrf
  const res = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  const json = text ? JSON.parse(text) as { message?: string } : undefined
  if (!res.ok) throw new BffError(res.status, json?.message ?? `HTTP ${res.status}`)
  return json as T
}

/** the logged-in customer, or `null` (no session, or a guest's) */
export async function currentCustomer(): Promise<Customer | null> {
  const res = await fetch('/bff/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  if (res.status === 401) return null
  if (!res.ok) throw new BffError(res.status, `me: HTTP ${res.status}`)
  const body = (await res.json()) as { user: string; name: string; csrf: string }
  csrf = body.csrf
  user = body.user
  return { user: body.user, name: body.name }
}

/** the customer login; a wrong id or password is a `BffError` 401 */
export async function customerLogin(username: string, password: string): Promise<Customer> {
  const res = await fetch('/bff/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ username, password }) })
  const body = (await res.json().catch(() => ({}))) as { user?: string; name?: string; csrf?: string; message?: string }
  if (!res.ok) throw new BffError(res.status, res.status === 401 ? 'Nama pengguna atau password salah' : body.message ?? `HTTP ${res.status}`)
  csrf = body.csrf
  user = body.user
  return { user: body.user!, name: body.name! }
}

export async function customerLogout(): Promise<void> {
  try { await call('POST', '/bff/logout') } finally { csrf = undefined; user = undefined }
}

export const activities = () => call<{ activities: Activity[]; codes: string[] }>('GET', '/bff/activities')
export const tickActivities = (codes: string[]) => call<{ codes: string[] }>('PUT', '/bff/activities', { codes })
export const insights = () => call<Insight[]>('GET', '/bff/insights')
/** delete every 👍 / 👎 this customer gave; the insights then open with no choice */
export const resetFeedback = () => call<{ deleted: number }>('DELETE', '/bff/feedback')

/** the names the engine may resolve (catalog-service); empty when it cannot be read (fail closed) */
export async function appCatalog(fetchImpl: typeof fetch = fetch): Promise<AppCatalog> {
  try {
    const res = await fetchImpl('/bff/catalog', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!res.ok) return EMPTY_CATALOG
    return { ...EMPTY_CATALOG, ...((await res.json()) as Partial<AppCatalog>) }
  } catch {
    return EMPTY_CATALOG
  }
}

export async function session(refresh = false): Promise<{ user: string; csrf: string }> {
  if (!csrf || refresh) {
    const res = await fetch('/bff/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`session: HTTP ${res.status}`)
    const body = (await res.json()) as { user: string; csrf: string }
    csrf = body.csrf
    user = body.user
  }
  return { user: user!, csrf: csrf! }
}

/** a merchant with a published page (the customer app's merchant switcher) */
export interface PublicMerchant { merchantId: string; name: string }

/** every merchant that has at least one published page (public, through web-bff → delivery) */
export async function publicMerchants(): Promise<PublicMerchant[]> {
  const res = await fetch('/bff/sdui/merchants', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`merchants: HTTP ${res.status}`)
  return (await res.json()) as PublicMerchant[]
}

/** headers for `fetchNetworkClient({ getHeaders })`: a 401 refreshes the session once */
export async function csrfHeaders({ refresh }: { refresh: boolean }): Promise<Record<string, string>> {
  return { 'X-CSRF-Token': (await session(refresh)).csrf }
}
