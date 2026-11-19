/**
 * A page in the Studio: ONE editor for its design and its content, still stored apart —
 * the template (structure, layout, style, actions; no content) in template-service and the
 * value set (the content of each component) in value-service. One "Terbitkan" publishes both
 * (studio-bff: the template first when its design changed, then the page at that release).
 *
 * Framework-free: the React and Vue Studios share this file (src/sdui stays identical).
 */
import { TemplateDocument, ValuesDocument, sortedJSONStringify } from '@fajekrina/sdui-r'
import { mergeContent, splitContent } from '@fajekrina/sdui-r/builder'
import { studio, type ScreenDetail, type TemplateDetail } from '../api/studio'

type Json = Record<string, unknown>

/** what the Studio has loaded for one page (null: not created yet) */
export interface PageState {
  template: TemplateDetail | null
  page: ScreenDetail | null
}

const merged = (template: unknown, values: unknown): { document: Json; dropped: string[] } => {
  const { document, dropped } = mergeContent(TemplateDocument.decode(template), values ? ValuesDocument.decode(values) : null)
  return { document: document.toJSON() as Json, dropped }
}

/**
 * The tree the editor opens: the template's draft (else its release) with the page's content
 * draft (else its release) written in. `dropped`: content of components the design no longer has.
 */
export function editorSource(state: PageState): { source?: Json; dropped: string[] } {
  const template = state.template?.draft ?? state.template?.active?.payload
  if (!template) return { dropped: [] }
  const { document, dropped } = merged(template, state.page?.draft ?? state.page?.active?.payload)
  return { source: document, dropped }
}

/** what is live (the active template release with the page's active content): the editor lists the changes against it */
export function baselineOf(state: PageState): Json | undefined {
  const template = state.template?.active?.payload
  return template ? merged(template, state.page?.active?.payload).document : undefined
}

// the server sets the key and the version of a template draft itself
const design = (doc: unknown): string => {
  const d = doc as { schemaVersion?: unknown; template?: Json }
  return sortedJSONStringify({ schemaVersion: d.schemaVersion, template: { ...d.template, key: undefined, version: undefined } } as never)
}
const content = (doc: unknown): string => sortedJSONStringify(doc as never)

/**
 * Save the editor's tree as drafts: the design (only when it changed, so a content-only edit
 * starts no new template version) and the content for the template version being drafted.
 */
export async function savePageDraft(key: string, payload: unknown, state: PageState): Promise<PageState> {
  const { template, values } = splitContent(TemplateDocument.decode(payload), key)
  let t = state.template
  const designJSON = template.toJSON()
  if (!t?.draft || design(t.draft) !== design(designJSON)) t = await studio.saveTemplate(key, designJSON, t?.lockVersion)
  const version = (t.draft as { template: { version: number } }).template.version
  const valuesJSON = { schemaVersion: values.schemaVersion, values: { ...values.values.toJSON(), template: { key, version } } }
  let p = state.page
  // a page never filled needs no draft: Terbitkan creates it
  const filled = Object.keys(values.values.components).length > 0
  if (p ? content(p.draft) !== content(valuesJSON) : filled) p = await studio.saveScreen(key, valuesJSON, p?.lockVersion)
  return { template: t, page: p }
}

/**
 * Save, then publish the page (design + content) at once. `onSaved` gets the saved drafts
 * first, so a failed publish still leaves the Studio on their lock versions.
 */
export async function publishPage(key: string, payload: unknown, state: PageState, onSaved: (saved: PageState) => void): Promise<PageState & { dropped: string[] }> {
  onSaved(await savePageDraft(key, payload, state))
  const res = await studio.publishPage(key)
  return { template: res.template, page: res.page, dropped: res.dropped }
}
