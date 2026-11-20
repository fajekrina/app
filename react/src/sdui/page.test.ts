import { beforeEach, describe, expect, it, vi } from 'vitest'

// the studio-bff client, recorded
const calls: Array<[string, ...unknown[]]> = []
const PAGES: Array<{ kanal: string; key: string; templateKey: string; templateVersion: number }> = []
vi.mock('../api/studio', () => ({
  StudioError: class extends Error { constructor(readonly status: number, message: string) { super(message) } },
  studio: {
    saveTemplate: vi.fn(async (key: string, payload: { template: object }) => {
      calls.push(['saveTemplate', key])
      return { key, lockVersion: 2, activeVersion: 1, draft: { ...payload, template: { ...payload.template, key, version: 2 } } }
    }),
    publishTemplate: vi.fn(async (key: string) => { calls.push(['publishTemplate', key]); return { key, activeVersion: 2 } }),
    saveScreen: vi.fn(async (kanal: string, key: string, payload: unknown) => {
      calls.push(['saveScreen', kanal, key, payload])
      return { key, lockVersion: 5, draft: payload }
    }),
    publishScreen: vi.fn(async (kanal: string, key: string, version?: number) => {
      calls.push(['publishScreen', kanal, key, version])
      if (key === 'broken') throw new Error('nope')
      return { key, activeSequence: 3, dropped: version ? ['gone'] : undefined }
    }),
    pages: vi.fn(async () => PAGES),
    screen: vi.fn(async (_kanal: string, key: string) => ({ key, draft: VALUES, active: null }))
  }
}))

const { createPage, pageBaseline, pageSource, pageValues, pagesToUpdate, publishPage, publishTemplateDraft, sampleTexts, savePage, updatePages } = await import('./page')

// a shared template (with its sample texts) and a page's values (2.6: what differs)
const TEMPLATE = {
  schemaVersion: '2.6',
  template: { key: 'insight', version: 1, root: { type: 'vstack', id: 'root', order: 0, props: { spacing: 8 }, children: [
    { type: 'text', id: 'title', order: 0, props: { value: '[Insight Title]', size: 18 } },
    { type: 'button', id: 'cta', order: 1, props: { title: '[CTA Text]', variant: 'primary' }, action: { type: 'dismiss' } }
  ] } }
}
const VALUES = { schemaVersion: '2.6', values: { screen: 'insightKopi', template: { key: 'insight', version: 1 }, components: {
  title: { props: { value: 'Kopi bulan ini', color: '#0F766E' } },
  cta: { action: { type: 'navigate', screen: 'kopiDetail' } }
} } }
const page = () => ({ key: 'insightKopi', templateKey: 'insight', templateVersion: 1, lockVersion: 4, draft: VALUES, active: { sequence: 1, payload: VALUES } }) as never
type Doc = { template: { root: { children: Array<{ props: Record<string, unknown>; action?: unknown }> } } }

beforeEach(() => { calls.length = 0; PAGES.length = 0 })

describe('Konten: a page = a template + what it sets', () => {
  it('opens the template with the page written in (content, style, action)', () => {
    const { source, dropped } = pageSource(TEMPLATE, page())
    expect(dropped).toEqual([])
    const children = (source as unknown as Doc).template.root.children
    expect(children[0]!.props).toEqual({ value: 'Kopi bulan ini', size: 18, color: '#0F766E' })
    expect(children[1]!.action).toEqual({ type: 'navigate', screen: 'kopiDetail' })
    expect(pageBaseline(TEMPLATE, page())).toEqual(source)
    expect(sampleTexts(source)).toEqual(['cta.title'])
  })

  it('stores only what differs from the template; an unchanged page is not saved again', async () => {
    const edited = structuredClone(pageSource(TEMPLATE, page()).source) as unknown as Doc
    edited.template.root.children[1]!.props.title = 'Lihat'
    edited.template.root.children[0]!.props.size = 18   // the template's own value: not stored
    expect(pageValues('insightKopi', edited, TEMPLATE)).toMatchObject({ values: { components: {
      title: { props: { value: 'Kopi bulan ini', color: '#0F766E' } },
      cta: { props: { title: 'Lihat' }, action: { type: 'navigate', screen: 'kopiDetail' } }
    } } })
    await savePage('wondr', 'insightKopi', edited, TEMPLATE, page())
    expect(calls.map((c) => c[0])).toEqual(['saveScreen'])
    calls.length = 0
    await savePage('wondr', 'insightKopi', pageSource(TEMPLATE, page()).source, TEMPLATE, page())
    expect(calls).toEqual([])
  })

  it('Terbitkan saves, then publishes the page', async () => {
    const onSaved = vi.fn()
    const res = await publishPage('wondr', 'insightKopi', pageSource(TEMPLATE, page()).source, TEMPLATE, page(), onSaved)
    expect(onSaved).toHaveBeenCalledOnce()
    expect(calls).toEqual([['publishScreen', 'wondr', 'insightKopi', undefined]])
    expect(res.page.activeSequence).toBe(3)
  })

  it('a new page starts from a template release with no values', async () => {
    await createPage('wondr', 'insightBaru', 'insight', 1)
    expect(calls[0]!.slice(0, 3)).toEqual(['saveScreen', 'wondr', 'insightBaru'])
    expect(calls[0]![3]).toEqual({ schemaVersion: '2.6', values: { screen: 'insightBaru', template: { key: 'insight', version: 1 }, components: {} } })
  })
})

describe('Template: release, then the pages made from it', () => {
  it('an unchanged design is not saved again before it is released', async () => {
    const t = { key: 'insight', lockVersion: 1, activeVersion: 1, draft: TEMPLATE } as never
    const res = await publishTemplateDraft('insight', TEMPLATE, t, vi.fn())
    expect(calls.map((c) => c[0])).toEqual(['publishTemplate'])
    expect(res.template.activeVersion).toBe(2)
  })

  it('lists the pages behind the release with what they would lose; updates the chosen ones', async () => {
    PAGES.push({ kanal: 'wondr', key: 'insightKopi', templateKey: 'insight', templateVersion: 1 }, { kanal: 'wondr', key: 'fresh', templateKey: 'insight', templateVersion: 2 })
    const v2 = structuredClone(TEMPLATE)
    v2.template.version = 2
    v2.template.root.children.pop()   // the release drops the button
    const behind = await pagesToUpdate('insight', 2, v2)
    expect(behind.map((p) => [p.key, p.dropped])).toEqual([['insightKopi', ['cta']]])
    const results = await updatePages([{ kanal: 'wondr', key: 'insightKopi' }, { kanal: 'wondr', key: 'broken' }], 2)
    expect(results).toEqual([
      { kanal: 'wondr', key: 'insightKopi', ok: true, dropped: ['gone'] },
      { kanal: 'wondr', key: 'broken', ok: false, dropped: [], error: 'nope' }
    ])
  })
})
