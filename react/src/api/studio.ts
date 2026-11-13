/**
 * studio-bff client: a workforce session (dev login with roles), CSRF on every write, and
 * the relayed template-service / value-service APIs.
 */
export const ROLES = ['SDUI_TEMPLATE_ADMIN', 'SDUI_TEMPLATE_PUBLISHER', 'SDUI_AUTHOR', 'SDUI_PUBLISHER', 'SDUI_VIEWER'] as const
export type Role = typeof ROLES[number]

export interface Me { sub: string; name: string; roles: Role[]; merchants: string[]; csrf: string }
export interface TemplateRow { key: string; title?: string; status: string; activeVersion?: number; lockVersion: number; pending: number }
export interface TemplateDetail extends TemplateRow { draft: unknown | null; active: { version: number; payload: object } | null; releases: { version: number }[] }
export interface ScreenRow { key: string; templateKey: string; templateVersion: number; status: string; activeSequence?: number; lockVersion: number; pending: number }
export interface ScreenDetail extends ScreenRow { draft: unknown | null; active: { sequence: number; payload: object } | null }
export interface RequestRow { id: number; key: string; status: string; note?: string; requestedBy: string; decidedBy?: string; reason?: string; revision: number }
export interface CatalogEntry { key: string; version: number; title?: string }

export class StudioError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

let me: Me | undefined

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && me) headers['X-CSRF-Token'] = me.csrf
  if (method === 'POST') headers['Idempotency-Key'] = crypto.randomUUID()
  const res = await fetch(`/studio-bff${path}`, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  const json: unknown = text ? JSON.parse(text) : undefined
  if (!res.ok) throw new StudioError(res.status, (json as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`)
  return json as T
}

export const studio = {
  current: () => me,
  has: (role: Role) => !!me?.roles.includes(role),
  async login(username: string, roles: Role[], merchants: string[]): Promise<Me> {
    me = await call<Me>('POST', '/login', { username, roles, merchants })
    return me
  },
  async restore(): Promise<Me | undefined> {
    try { me = await call<Me>('GET', '/me') } catch { me = undefined }
    return me
  },
  async logout(): Promise<void> {
    try { await call('POST', '/logout') } finally { me = undefined }
  },

  templates: () => call<TemplateRow[]>('GET', '/templates'),
  template: (key: string) => call<TemplateDetail>('GET', `/templates/${key}`),
  saveTemplate: (key: string, payload: unknown, lockVersion?: number) => call<TemplateDetail>('PUT', `/templates/${key}/draft`, { payload, lockVersion }),
  submitTemplate: (key: string, note: string) => call<RequestRow>('POST', `/templates/${key}/requests`, { note }),
  templateRequests: (status?: string) => call<RequestRow[]>('GET', `/template-requests${status ? `?status=${status}` : ''}`),
  decideTemplate: (id: number, decision: 'approve' | 'reject' | 'withdraw', reason?: string) =>
    call<unknown>('POST', `/template-requests/${id}/${decision}`, decision === 'reject' ? { reason } : undefined),

  catalog: () => call<CatalogEntry[]>('GET', '/catalog/templates'),
  releasedTemplate: (key: string, version: number) => call<unknown>('GET', `/catalog/templates/${key}/v${version}`),

  merchants: () => call<{ merchantId: string; name: string }[]>('GET', '/merchants'),
  screens: (mid: string) => call<ScreenRow[]>('GET', `/merchants/${mid}/screens`),
  screen: (mid: string, key: string) => call<ScreenDetail>('GET', `/merchants/${mid}/screens/${key}`),
  saveScreen: (mid: string, key: string, payload: unknown, lockVersion?: number) => call<ScreenDetail>('PUT', `/merchants/${mid}/screens/${key}/draft`, { payload, lockVersion }),
  submitScreen: (mid: string, key: string, note: string) => call<RequestRow>('POST', `/merchants/${mid}/screens/${key}/requests`, { note }),
  screenRequests: (mid: string, status?: string) => call<RequestRow[]>('GET', `/merchants/${mid}/requests${status ? `?status=${status}` : ''}`),
  decideScreen: (mid: string, id: number, decision: 'approve' | 'reject' | 'withdraw', reason?: string) =>
    call<unknown>('POST', `/merchants/${mid}/requests/${id}/${decision}`, decision === 'reject' ? { reason } : undefined)
}
