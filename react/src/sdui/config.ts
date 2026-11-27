/**
 * sdui-r names of this app. Payloads only NAME things — requests, links, images. Requests and
 * links come from the catalog (catalog-service, through web-bff); images are mapped here. A name
 * that is in neither fails closed in the engine.
 */
import type { Endpoint } from '@fajekrina/sdui-r/browser'

/** delivery-service client API, through web-bff (same origin): this app's path of each operation */
export const DELIVERY_ROUTES = {
  screen: '/bff/sdui/screens/{space}/{key}',
  screenRelease: '/bff/sdui/screens/{space}/{key}/v{sequence}',
  template: '/bff/sdui/templates/{space}/{key}/v{version}',
  manifest: '/bff/sdui/manifest/{space}'
}
/** named domain requests, through web-bff */
export const API_BASE = '/bff/api'

/** the page `/` opens; the merchant switcher lists every merchant with a published page (`publicMerchants`) */
export const DEFAULT_MERCHANT = 'merchant_demo'
export const DEFAULT_SCREEN = 'home'

/** the languages the app offers to switch to (spec 2.8); a page without one shows its default texts */
export const LANGUAGES: Array<{ code: string; label: string }> = [{ code: 'id', label: 'Bahasa Indonesia' }, { code: 'en', label: 'English' }]
const LANGUAGE_KEY = 'sdui-r-language'

/** the languages the app asks pages in, most wanted first: the one picked in the app, else the browser's */
export function appLanguages(): string[] {
  let picked: string | null = null
  try { picked = localStorage.getItem(LANGUAGE_KEY) } catch { /* private mode */ }
  const browser = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? [navigator.language])]
  return [...new Set([...(picked ? [picked] : []), ...browser].filter(Boolean))]
}

/** pick the app's language (remembered in this browser) */
export function setAppLanguage(code: string): void {
  try { localStorage.setItem(LANGUAGE_KEY, code) } catch { /* private mode */ }
}

/**
 * Requests, chart sources and links are NOT listed here any more: they live in catalog-service
 * (the database) and reach the engine through `GET /bff/catalog` (`appCatalog`), the Studio
 * through `GET /studio-bff/names`. Every request goes to `/bff/api/<name>`; web-bff sends it to
 * the service the catalog names. Images (`ASSETS`) are still this bundle's.
 */
export interface AppCatalog {
  /** name → method (`kind`: an `api` a button sends, or a `source` a chart / page load reads) */
  requests: Record<string, { method: 'GET' | 'POST'; kind?: 'api' | 'source' }>
  /** `openURL.link` name → https URL */
  links: Record<string, string>
  screens: string[]
  commands: string[]
}

export const EMPTY_CATALOG: AppCatalog = { requests: {}, links: {}, screens: [], commands: [] }

/** the engine's endpoints: every catalog request at `/bff/api/<name>` with its method */
export function endpointsOf(catalog: AppCatalog): Record<string, Endpoint> {
  return Object.fromEntries(Object.entries(catalog.requests).map(([name, r]) => [name, { method: r.method, path: `/${name}` } satisfies Endpoint]))
}

/** `image.name` → URL */
export const ASSETS: Record<string, string> = {
  'event-jazz-01': 'https://picsum.photos/seed/event-jazz-01/600/400',
  'event-rock-02': 'https://picsum.photos/seed/event-rock-02/600/400',
  'event-orchestra-03': 'https://picsum.photos/seed/event-orchestra-03/600/400',
  placeholder: 'https://picsum.photos/seed/placeholder/600/400'
}

/** an uploaded picture (value-service asset), named in `image.name` */
export const ASSET_ID = /^img_[0-9a-f]{32}$/

/**
 * Bundle names map to their URL; uploaded pictures (`img_…`) to web-bff, which serves them once
 * their release is published. Unknown names resolve to nothing (the engine never loads an
 * arbitrary host).
 */
export function assetURL(name: string): string {
  if (ASSET_ID.test(name)) return `/bff/assets/${name}`
  return ASSETS[name] ?? ''
}

/** the Studio preview: a merchant's uploaded pictures, drafts included (studio-bff) */
export function studioAssetURL(merchantId: string): (name: string) => string {
  return (name) => ASSET_ID.test(name) ? `/studio-bff/merchants/${encodeURIComponent(merchantId)}/assets/${name}` : assetURL(name)
}

/** a made-up summary for the builder preview of a chart source */
const sample = (keys: Array<[string, string]>) => ({ items: keys.map(([key, label], i) => ({ key, label, value: [120, 80, 150, 60, 110, 95][i % 6]! })) })
const MONTHS: Array<[string, string]> = [['jan', 'Januari'], ['feb', 'Februari'], ['mar', 'Maret'], ['apr', 'April'], ['mei', 'Mei'], ['jun', 'Juni']]

/** sample data for `{{tokens}}` and chart sources in the builder preview (the app fetches the real ones) */
export const SAMPLE_DATA = {
  seatId: 'A1', eventId: 'event-jazz-01', user: { name: 'Ada' },
  salesSummary: sample(MONTHS),
  cancellationSummary: sample(MONTHS),
  refundSummary: sample(MONTHS),
  paymentMethodSummary: sample([['va', 'Virtual account'], ['card', 'Kartu kredit'], ['ewallet', 'E-wallet'], ['qris', 'QRIS']]),
  ticketCategorySummary: sample([['vip', 'VIP'], ['festival', 'Festival'], ['tribune', 'Tribun']]),
  coffeeSpending: {
    items: [
      { key: '2025-02', label: 'Feb 2025', value: 600000, amount: 'Rp600.000', color: '#FDE8E8' },
      { key: '2025-03', label: 'Mar 2025', value: 750000, amount: 'Rp750.000', color: '#FDE8E8' },
      { key: '2025-04', label: 'Apr 2025', value: 1300000, amount: 'Rp1.300.000', color: '#FDE8E8' }
    ],
    peak: { label: 'Apr 2025', value: 1300000, amount: 'Rp1.300.000' },
    note: 'Selama 3 bulan terakhir, pembelian kopi kamu meningkat terus.'
  },
  // the demo insights: the customer's earlier vote (a template `load`) and the electricity chart
  myFeedback: { vote: '' },
  electricityBill: {
    items: [['2025-05', 'Mei', 410000], ['2025-06', 'Jun', 395000], ['2025-07', 'Jul', 450000], ['2025-08', 'Agu', 430000], ['2025-09', 'Sep', 470000], ['2025-10', 'Okt', 555000]]
      .map(([key, label, value]) => ({ key, label, value, amount: `Rp${Number(value).toLocaleString('id-ID')}`, color: '#FDF2D0' })),
    average: 'Rp452.000', highest: 'Rp555.000', forecast: 'Rp525.000'
  },
  depositMaturity: {
    items: [{ key: 'deposito', label: 'Deposito', value: 15000000 }],
    nominal: '15.000.000',
    amount: 'Rp15.000.000'
  }
}

/** screen keys are identifiers: old kebab-case links (`seat-selection`) → `seatSelection` */
export function specScreenKey(key: string): string {
  return key.replace(/-+([A-Za-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/-/g, '')
}

/** merchant ids are identifiers (they appear in delivery URLs) */
export function isMerchantId(id: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(id)
}

/** the Studio's one page space (new pages render at `/s/<page>`, no merchant / kanal / user) */
export const PAGE_SPACE = 'sdui'

/** the customer app's address of a page: `/s/<page>`; an older space's page `/s/<space>/<page>` */
export function screenPath(merchantId: string, screen: string): string {
  if (merchantId === PAGE_SPACE) return `/s/${encodeURIComponent(screen)}`
  return `/s/${encodeURIComponent(merchantId)}/${encodeURIComponent(screen)}`
}
