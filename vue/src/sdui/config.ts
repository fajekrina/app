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

export const MERCHANTS = ['merchant_demo', 'merchant_promo'] as const
export const DEFAULT_MERCHANT = 'merchant_demo'
export const DEFAULT_SCREEN = 'home'

/** `api.request` names → web-bff endpoints */
export const ENDPOINTS: Record<string, Endpoint> = {
  submitCheckout: { method: 'POST', path: '/submitCheckout' }
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

/** Unknown names resolve to nothing (the engine never loads an arbitrary host). */
export function assetURL(name: string): string {
  return ASSETS[name] ?? ''
}

/** names the builders offer (the same allow-lists) */
export const CATALOG = {
  screens: ['home', 'seatSelection', 'checkout'],
  requests: Object.keys(ENDPOINTS),
  links: Object.keys(LINKS),
  commands: [] as string[],
  assets: Object.keys(ASSETS)
}

/** sample data for `{{tokens}}` in the builder preview */
export const SAMPLE_DATA = { seatId: 'A1', eventId: 'event-jazz-01', user: { name: 'Ada' } }

/** screen keys are identifiers: old kebab-case links (`seat-selection`) → `seatSelection` */
export function specScreenKey(key: string): string {
  return key.replace(/-+([A-Za-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/-/g, '')
}
