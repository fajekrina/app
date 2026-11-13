/**
 * The sdui-r engine of this app (HLD Target web §4.1): signed bundles (value set + its
 * template) from delivery-service through web-bff, the manifest (versioned, immutable
 * URLs), an encrypted IndexedDB cache with offline last-good, named requests to web-bff
 * with the session's CSRF token, and navigation through the router.
 */
import {
  ActionDispatcher, PayloadSecurity, SduiCache, base64Decode, createEngine, keyedVerifier,
  type CacheCipher, type CacheStore, type SduiEngine, type SduiEvent, type SduiProps
} from '@fajekrina/sdui-r'
import { MESSAGES_ID } from '@fajekrina/sdui-r/i18n'
import {
  aesGcmCipher, browserNavigator, fetchNetworkClient, generateAesKey, indexedDbStore,
  specManifestLoader, templateScreenProvider, webCryptoEd25519, windowViewport
} from '@fajekrina/sdui-r/browser'
import { connectivity } from '@fajekrina/sdui-r/pwa'
import { API_BASE, DELIVERY_BASE, ENDPOINTS, LINKS, assetURL } from './config'
import { SDUI_KEYS } from './keys.generated'
import { csrfHeaders } from '../api/bff'

export interface EngineOptions {
  merchantId: string
  /** the app router: open screen `key` with navigation params */
  navigate: (key: string, params: SduiProps) => void
  /** persistent cache tier (default IndexedDB) and its cipher (default AES-GCM, per tab) */
  store?: CacheStore
  cipher?: CacheCipher
  fetchImpl?: typeof fetch
  onEvent?: (event: SduiEvent) => void
}

/// The public keys are pinned in the bundle (`npm run gen:keys`), never fetched at run time.
async function verifier() {
  const entries = await Promise.all(SDUI_KEYS.map(async (k) => [k.keyId, await webCryptoEd25519(base64Decode(k.publicKey)!)] as const))
  return keyedVerifier(Object.fromEntries(entries))
}

export async function createSduiEngine(options: EngineOptions): Promise<SduiEngine> {
  const delivery = { basePath: DELIVERY_BASE, merchantId: options.merchantId, fetchImpl: options.fetchImpl }
  return createEngine({
    security: PayloadSecurity.signed(await verifier()),
    screenFactory: templateScreenProvider(delivery),
    manifestLoader: specManifestLoader(delivery),
    // dev: the AES key lives for the tab; target: a non-extractable per-device key in IndexedDB
    cache: new SduiCache({ store: options.store ?? indexedDbStore(`sdui-r-${options.merchantId}`), cipher: options.cipher ?? aesGcmCipher(await generateAesKey()) }),
    actionDispatcher: new ActionDispatcher({
      network: fetchNetworkClient({ baseUrl: API_BASE, endpoints: ENDPOINTS, credentials: 'same-origin', getHeaders: csrfHeaders, fetchImpl: options.fetchImpl }),
      navigator: browserNavigator({ navigate: (screen, params) => options.navigate(screen, params), links: LINKS })
    }),
    connectivity: typeof window === 'undefined' ? undefined : connectivity(),
    assetURL,
    messages: MESSAGES_ID,
    viewport: typeof window === 'undefined' ? undefined : windowViewport(),
    onEvent: options.onEvent,
    debug: import.meta.env.DEV
  })
}
