import { beforeEach, describe, expect, it, vi } from 'vitest'

// the studio-bff client, recorded
const calls: Array<[string, string, unknown]> = []
vi.mock('../api/studio', () => ({
  studio: {
    saveTemplate: vi.fn(async (key: string, payload: { template: object }) => {
      calls.push(['saveTemplate', key, payload])
      return { key, lockVersion: 2, activeVersion: 1, draft: { ...payload, template: { ...payload.template, key, version: 2 } } }
    }),
    saveScreen: vi.fn(async (key: string, payload: unknown) => {
      calls.push(['saveScreen', key, payload])
      return { key, lockVersion: 5, draft: payload }
    }),
    publishPage: vi.fn(async (key: string) => {
      calls.push(['publishPage', key, undefined])
      return { template: { key, activeVersion: 2 }, page: { key, activeSequence: 3 }, dropped: [] }
    })
  }
}))

const { baselineOf, editorSource, publishPage, savePageDraft } = await import('./page')

// the stored halves of one page: a template without content, and its content
const TEMPLATE = {
  schemaVersion: '2.2',
  template: { key: 'insight', version: 1, root: { type: 'vstack', id: 'root', order: 0, props: { spacing: 8 }, children: [
    { type: 'text', id: 'text1', order: 0, props: { style: 'title' } },
    { type: 'button', id: 'button1', order: 1, props: { variant: 'primary' }, action: { type: 'api', request: 'submitCheckout' } }
  ] } }
}
const VALUES = { schemaVersion: '2.2', values: { screen: 'insight', template: { key: 'insight', version: 1 }, components: { text1: { props: { value: 'Halo' } }, button1: { props: { title: 'Kirim' } } } } }
const state = () => ({
  template: { key: 'insight', lockVersion: 1, activeVersion: 1, draft: TEMPLATE, active: { version: 1, payload: TEMPLATE } } as never,
  page: { key: 'insight', lockVersion: 4, draft: VALUES, active: { sequence: 1, payload: VALUES } } as never
})
type Doc = { template: { root: { children: Array<{ props: Record<string, unknown> }> } } }
const edited = (change: (doc: Doc) => void) => {
  const doc = structuredClone(editorSource(state()).source) as unknown as Doc
  change(doc)
  return doc
}

beforeEach(() => { calls.length = 0 })

describe('one editor for a page, two stores', () => {
  it('opens the design with its content written in', () => {
    const { source, dropped } = editorSource(state())
    expect(dropped).toEqual([])
    const children = (source as unknown as Doc).template.root.children
    expect(children[0]!.props).toEqual({ style: 'title', value: 'Halo' })
    expect(children[1]!.props).toEqual({ variant: 'primary', title: 'Kirim' })
    expect(baselineOf(state())).toEqual(source)
  })

  it('a content-only edit saves the content, not a new template version', async () => {
    await savePageDraft('insight', edited((d) => { d.template.root.children[0]!.props.value = 'Halo lagi' }), state())
    expect(calls.map((c) => c[0])).toEqual(['saveScreen'])
    const values = (calls[0]![2] as typeof VALUES).values
    expect(values.template).toEqual({ key: 'insight', version: 1 })
    expect(values.components.text1).toEqual({ props: { value: 'Halo lagi' } })
  })

  it('a design edit saves the template without content, then the content for its draft version', async () => {
    await savePageDraft('insight', edited((d) => { d.template.root.children[0]!.props.style = 'headline' }), state())
    expect(calls.map((c) => c[0])).toEqual(['saveTemplate', 'saveScreen'])
    const template = calls[0]![2] as Doc
    expect(template.template.root.children[0]!.props).toEqual({ style: 'headline' })
    expect(template.template.root.children[1]!.props).toEqual({ variant: 'primary' })
    // the same content, now for the template version being drafted
    const values = (calls[1]![2] as typeof VALUES).values
    expect(values.template).toEqual({ key: 'insight', version: 2 })
    expect(values.components).toEqual(VALUES.values.components)
  })

  it('nothing changed: nothing is saved; Terbitkan still publishes the page', async () => {
    const saved = vi.fn()
    const res = await publishPage('insight', editorSource(state()).source, state(), saved)
    expect(calls.map((c) => c[0])).toEqual(['publishPage'])
    expect(saved).toHaveBeenCalledOnce()
    expect(res.page?.activeSequence).toBe(3)
  })
})
