import { describe, expect, it } from 'vitest'
import { MemoryCacheStore, PassthroughCipher, ScreenSource } from '@fajekrina/sdui-r'
import { createSduiEngine } from './engine'
import { specScreenKey } from './config'

const TEMPLATE = { schemaVersion: '2.0', template: { key: 't', version: 1, root: { type: 'text', id: 'root', order: 0, props: { value: 'x' } } } }
const VALUES = { schemaVersion: '2.0', values: { screen: 'home', template: { key: 't', version: 1 }, components: { root: { props: { value: 'HACKED' } } } } }

describe('engine', () => {
  it('accepts only bundles signed by a pinned key', async () => {
    const fetchImpl = (async (url: RequestInfo | URL) => {
      const u = String(url)
      if (u.includes('/templates/')) return new Response(JSON.stringify(TEMPLATE))
      if (u.includes('/screens/')) return new Response(JSON.stringify(VALUES))
      return new Response('{}', { status: 404 })
    }) as typeof fetch
    const engine = await createSduiEngine({ merchantId: 'm', navigate: () => {}, store: new MemoryCacheStore(), cipher: new PassthroughCipher(), fetchImpl })
    const state = await engine.load(ScreenSource.key('home'))
    expect(state.kind === 'failed' && state.error.kind).toBe('signatureInvalid')
  })

  it('maps old kebab-case keys to screen keys', () => {
    expect(specScreenKey('seat-selection')).toBe('seatSelection')
    expect(specScreenKey('home')).toBe('home')
  })
})
