/**
 * sdui-r allow-lists of this app. Payloads only NAME things — requests, links, images —
 * and this bundle maps the names. A name that is not here fails closed in the engine.
 * (Target: generated from the backend registry, `targets.generated.ts` — HLD Target web §4.2.)
 */
import type { Endpoint } from '@fajekrina/sdui-r/browser'

/** delivery-service client API, through web-bff (same origin) */
export const DELIVERY_BASE = '/bff/sdui'
/** named domain requests, through web-bff */
export const API_BASE = '/bff/api'

/** the page `/` opens; the merchant switcher lists every merchant with a published page (`publicMerchants`) */
export const DEFAULT_MERCHANT = 'merchant_demo'
export const DEFAULT_SCREEN = 'home'

/**
 * Chart data sources (`chart.source`): named data summaries from summary-service (dummy),
 * through web-bff. Each answers `{ title, unit, items: [{ key, label, value }] }` — the shape
 * a chart maps by default, so a maker only picks one. Name → [web-bff path, title].
 */
export const DATA_SOURCES: Record<string, [path: string, title: string]> = {
  salesSummary: ['/summaries/sales', 'Penjualan tiket per bulan'],
  cancellationSummary: ['/summaries/cancellations', 'Pembatalan per bulan'],
  refundSummary: ['/summaries/refunds', 'Refund per bulan'],
  paymentMethodSummary: ['/summaries/paymentMethods', 'Metode pembayaran'],
  ticketCategorySummary: ['/summaries/ticketCategories', 'Penjualan per kategori tiket'],
  // insightV2: also `peak` ({ label, value, amount }) and `note`, read by the page's texts as tokens
  coffeeSpending: ['/summaries/coffeeSpending', 'Pembelian kopi per bulan (insight)']
}

/** `api.request` names → web-bff endpoints (domain requests and the data summaries) */
export const ENDPOINTS: Record<string, Endpoint> = {
  submitCheckout: { method: 'POST', path: '/submitCheckout' },
  ...Object.fromEntries(Object.entries(DATA_SOURCES).map(([name, [path]]) => [name, { method: 'GET', path } satisfies Endpoint]))
}

/** `openURL.link` names → https URLs */
export const LINKS: Record<string, string> = {
  privacyPolicy: 'https://example.com/privacy',
  terms: 'https://example.com/terms',
  contactSupport: 'https://example.com/contact'
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

/**
 * names the builders offer (the same allow-lists). `screens` = the templates (set by the Studio
 * pages); `requests` = what an `api` action of a button (or a form) sends; `sources` = what a
 * chart reads. Both stay `ENDPOINTS` names (one engine allow-list), the builder just offers
 * each where it belongs.
 */
export const CATALOG = {
  screens: [] as string[],
  requests: Object.keys(ENDPOINTS).filter((name) => !(name in DATA_SOURCES)),
  sources: Object.keys(DATA_SOURCES),
  links: Object.keys(LINKS),
  commands: [] as string[],
  assets: Object.keys(ASSETS)
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
      { key: '2025-02', label: 'Feb 2025', value: 600000, color: '#FDE8E8' },
      { key: '2025-03', label: 'Mar 2025', value: 750000, color: '#FDE8E8' },
      { key: '2025-04', label: 'Apr 2025', value: 1300000, color: '#D95C5C' }
    ],
    peak: { label: 'Apr 2025', value: 1300000, amount: 'Rp1.300.000' },
    note: 'Selama 3 bulan terakhir, pembelian kopi kamu meningkat terus.'
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

/** the customer app's address of a merchant's page: `/s/<merchant>/<screen>` */
export function screenPath(merchantId: string, screen: string): string {
  return `/s/${encodeURIComponent(merchantId)}/${encodeURIComponent(screen)}`
}
