/**
 * studio-bff client: a workforce session (dev login), CSRF on every write, and the relayed
 * template-service / value-service APIs.
 *
 * Studio users are internal: one role, no review step (what they publish is live at once), and
 * NOTHING belongs to a user — a user is only recorded as who made and published what.
 * - **Templates**: which components a page has, and their defaults. Every user sees them all.
 * - **Pages**: made from a template, setting any prop of its components (spec 2.6). Every user
 *   sees them all. New pages live in one space (`PAGE_SPACE`; the API calls it a merchant) and
 *   render at `/s/<page>`; older pages keep their old space (`merchant_demo` …).
 */
export interface Me { sub: string; name: string; roles: string[]; csrf: string }
/** a deprecated template starts no new page; pages that use it keep working */
export interface Deprecation { deprecated?: boolean; deprecationReason?: string | null; replacedBy?: string | null; deprecatedBy?: string | null; deprecatedAt?: string | null }
/** `unpublished`: the draft has changes that are not live yet */
export interface TemplateRow extends Deprecation { key: string; title?: string; status: string; activeVersion?: number; lockVersion: number; unpublished: boolean }
export interface Release { version: number; title?: string; publishedBy?: string; releasedAt?: string }
export interface TemplateDetail extends TemplateRow { draft: unknown | null; active: { version: number; payload: object; publishedBy?: string } | null; releases: Release[] }
/** a page of a kanal, made from a template */
export interface PageRow { kanal: string; key: string; templateKey: string; templateVersion: number; status: string; activeSequence?: number; unpublished: boolean }
export interface ScreenRow { key: string; templateKey: string; templateVersion: number; status: string; activeSequence?: number; lockVersion: number; unpublished: boolean }
export interface ScreenDetail extends ScreenRow { draft: unknown | null; active: { sequence: number; payload: object; publishedBy?: string } | null }
/** a template a kanal may use: `shared` (every Studio template) or the kanal's own older one */
export interface CatalogEntry extends Deprecation { key: string; version: number; title?: string; shared?: boolean }
/** an uploaded picture: `name` goes into `image.name` */
export interface AssetRow { name: string; contentType: string; size: number; source: 'UPLOAD' | 'URL'; sourceUrl?: string; originalName?: string; publishedAt?: string | null }

/** a catalog name the Studio offers */
export interface CatalogName { name: string; title: string; description?: string }
export interface StudioNames { requests: CatalogName[]; sources: CatalogName[]; screens: CatalogName[]; links: CatalogName[]; commands: CatalogName[] }

/** the builder's pick lists from the catalog (names only); images stay this bundle's */
export function studioCatalog(names: StudioNames | undefined, assets: string[]) {
  const pick = (list: CatalogName[] | undefined) => (list ?? []).map((n) => n.name)
  return { requests: pick(names?.requests), sources: pick(names?.sources), screens: pick(names?.screens), links: pick(names?.links), commands: pick(names?.commands), assets }
}

/** the one page space of the Studio: every new page, and the templates' pictures */
export const PAGE_SPACE = 'sdui'
/** @deprecated the same space as `PAGE_SPACE` */
export const SHARED_KANAL = PAGE_SPACE

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

const k = (id: string) => encodeURIComponent(id)

export const studio = {
  current: () => me,
  /** the dev login: a person's name (not a kanal) */
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

  // ---- the Template tab: shared templates
  /** the names the Studio offers (catalog-service): requests, sources, screens, links, commands */
  names: () => call<StudioNames>('GET', '/names'),
  templates: () => call<TemplateRow[]>('GET', '/templates'),
  template: (key: string) => call<TemplateDetail>('GET', `/templates/${key}`),
  saveTemplate: (key: string, payload: unknown, lockVersion?: number) => call<TemplateDetail>('PUT', `/templates/${key}/draft`, { payload, lockVersion }),
  /** publish the draft now (no review step); answers the template */
  publishTemplate: (key: string) => call<TemplateDetail>('POST', `/templates/${key}/publish`),
  /** no new pages from it; existing pages keep working */
  deprecateTemplate: (key: string, reason: string, replacedBy?: string) => call<TemplateDetail>('PUT', `/templates/${key}/deprecation`, { reason, replacedBy }),
  restoreTemplate: (key: string) => call<TemplateDetail>('DELETE', `/templates/${key}/deprecation`),
  /** every given release of a template (the Template Builder never reuses their component ids) */
  releasedTemplates: (key: string, versions: number[]) => Promise.all(versions.map((v) => call<unknown>('GET', `/catalog/templates/${SHARED_KANAL}/${key}/v${v}`))),

  // ---- the Konten tab: pages (`kanal` = the page's space: `PAGE_SPACE`, or an older one)
  /** the released templates a space may start a page from (the shared ones, and an older space's own) */
  catalog: (kanal: string) => call<CatalogEntry[]>('GET', `/catalog/templates/${k(kanal)}`),
  releasedTemplate: (kanal: string, key: string, version: number) => call<unknown>('GET', `/catalog/templates/${k(kanal)}/${key}/v${version}`),
  /** every page (`template`: only the pages made from it), of every space */
  pages: (template?: string) => call<PageRow[]>('GET', template ? `/pages?template=${encodeURIComponent(template)}` : '/pages'),
  screens: (kanal: string) => call<ScreenRow[]>('GET', `/merchants/${k(kanal)}/screens`),
  screen: (kanal: string, key: string) => call<ScreenDetail>('GET', `/merchants/${k(kanal)}/screens/${key}`),
  saveScreen: (kanal: string, key: string, payload: unknown, lockVersion?: number) => call<ScreenDetail>('PUT', `/merchants/${k(kanal)}/screens/${key}/draft`, { payload, lockVersion }),
  /**
   * publish the page now (no review step); with `templateVersion`, its values are carried over
   * to that template release first — the answer then lists what was `dropped`
   */
  publishScreen: (kanal: string, key: string, templateVersion?: number) =>
    call<ScreenDetail & { dropped?: string[] }>('POST', `/merchants/${k(kanal)}/screens/${key}/publish`, templateVersion === undefined ? undefined : { templateVersion }),

  /** pictures of a space (value-service keeps the bytes; a value set only names them) */
  assets: (kanal: string) => call<AssetRow[]>('GET', `/merchants/${k(kanal)}/assets`),
  /** a picked / dropped file, or a link the backend copies once, into a space; answers the asset name */
  async uploadAsset(kanal: string, source: { file: Blob & { name?: string } } | { url: string }): Promise<string> {
    const body = 'url' in source ? { url: source.url } : { filename: source.file.name ?? 'picture', data: await base64(source.file) }
    return (await call<AssetRow>('POST', `/merchants/${k(kanal)}/assets`, body)).name
  }
}
