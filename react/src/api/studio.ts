/**
 * studio-bff client: a workforce session (dev login), CSRF on every write, and the relayed
 * template-service / value-service APIs.
 *
 * One Studio role — the template admin — and the admin IS the merchant: its login name is its
 * merchant id. It owns that merchant's templates (no one else sees them) and fills that
 * merchant's pages. Publishing is direct (no review step).
 */
export interface Me { sub: string; name: string; roles: string[]; merchantId: string; csrf: string }
/** a deprecated template starts no new page; pages that use it keep working */
export interface Deprecation { deprecated?: boolean; deprecationReason?: string | null; replacedBy?: string | null; deprecatedBy?: string | null; deprecatedAt?: string | null }
/** `unpublished`: the draft has changes that are not live yet */
export interface TemplateRow extends Deprecation { key: string; title?: string; status: string; activeVersion?: number; lockVersion: number; unpublished: boolean }
export interface Release { version: number; title?: string; publishedBy?: string; releasedAt?: string }
export interface TemplateDetail extends TemplateRow { draft: unknown | null; active: { version: number; payload: object; publishedBy?: string } | null; releases: Release[] }
export interface ScreenRow { key: string; templateKey: string; templateVersion: number; status: string; activeSequence?: number; lockVersion: number; unpublished: boolean }
export interface ScreenDetail extends ScreenRow { draft: unknown | null; active: { sequence: number; payload: object; publishedBy?: string } | null }
export interface CatalogEntry extends Deprecation { key: string; version: number; title?: string }
/** an uploaded picture: `name` goes into `image.name` */
export interface AssetRow { name: string; contentType: string; size: number; source: 'UPLOAD' | 'URL'; sourceUrl?: string; originalName?: string; publishedAt?: string | null }

/** the builder's view of a deprecation (`null` = in use) */
export function deprecationOf(row: Deprecation | null | undefined): { reason?: string; replacedBy?: string; by?: string; at?: string } | null {
  if (!row?.deprecated) return null
  return { reason: row.deprecationReason ?? undefined, replacedBy: row.replacedBy ?? undefined, by: row.deprecatedBy ?? undefined, at: row.deprecatedAt ?? undefined }
}

/** a file as base64 (no data: prefix) */
async function base64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

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

/** the merchant of the session (the admin's own), for a URL */
const mid = () => {
  if (!me) throw new StudioError(401, 'login required')
  return encodeURIComponent(me.merchantId)
}

export const studio = {
  current: () => me,
  /** the admin's merchant id */
  merchantId: () => me?.merchantId ?? '',
  /** the dev login: the admin's name IS its merchant id */
  async login(username: string): Promise<Me> {
    me = await call<Me>('POST', '/login', { username })
    return me
  },
  async restore(): Promise<Me | undefined> {
    try { me = await call<Me>('GET', '/me') } catch { me = undefined }
    return me
  },
  async logout(): Promise<void> {
    try { await call('POST', '/logout') } finally { me = undefined }
  },

  // the admin's own templates
  templates: () => call<TemplateRow[]>('GET', '/templates'),
  template: (key: string) => call<TemplateDetail>('GET', `/templates/${key}`),
  saveTemplate: (key: string, payload: unknown, lockVersion?: number) => call<TemplateDetail>('PUT', `/templates/${key}/draft`, { payload, lockVersion }),
  /** publish the draft now (no review step); answers the template */
  publishTemplate: (key: string) => call<TemplateDetail>('POST', `/templates/${key}/publish`),
  /** no new pages from it; existing pages keep working */
  deprecateTemplate: (key: string, reason: string, replacedBy?: string) => call<TemplateDetail>('PUT', `/templates/${key}/deprecation`, { reason, replacedBy }),
  restoreTemplate: (key: string) => call<TemplateDetail>('DELETE', `/templates/${key}/deprecation`),

  /** the admin's released templates (latest of each key) */
  catalog: () => call<CatalogEntry[]>('GET', `/catalog/templates/${mid()}`),
  releasedTemplate: (key: string, version: number) => call<unknown>('GET', `/catalog/templates/${mid()}/${key}/v${version}`),
  /** every given release of a template (the Template Builder never reuses their component ids) */
  releasedTemplates: (key: string, versions: number[]) => Promise.all(versions.map((v) => call<unknown>('GET', `/catalog/templates/${mid()}/${key}/v${v}`))),

  // the admin's pages (a page IS its template: its key is the template key)
  screens: () => call<ScreenRow[]>('GET', `/merchants/${mid()}/screens`),
  screen: (key: string) => call<ScreenDetail>('GET', `/merchants/${mid()}/screens/${key}`),
  saveScreen: (key: string, payload: unknown, lockVersion?: number) => call<ScreenDetail>('PUT', `/merchants/${mid()}/screens/${key}/draft`, { payload, lockVersion }),
  /** publish the page's values now (no review step); answers the page */
  publishScreen: (key: string) => call<ScreenDetail>('POST', `/merchants/${mid()}/screens/${key}/publish`),
  /**
   * one "Terbitkan" for a page: its template (when the design draft is newer than the release),
   * then its content at that release; `dropped` = content of components the design no longer has
   */
  publishPage: (key: string) => call<{ template: TemplateDetail; page: ScreenDetail; dropped: string[] }>('POST', `/pages/${key}/publish`),

  /** pictures of the merchant (value-service keeps the bytes; a value set only names them) */
  assets: () => call<AssetRow[]>('GET', `/merchants/${mid()}/assets`),
  /** a picked / dropped file, or a link the backend copies once; answers the asset name */
  async uploadAsset(source: { file: Blob & { name?: string } } | { url: string }): Promise<string> {
    const body = 'url' in source ? { url: source.url } : { filename: source.file.name ?? 'picture', data: await base64(source.file) }
    return (await call<AssetRow>('POST', `/merchants/${mid()}/assets`, body)).name
  }
}
