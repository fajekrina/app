/**
 * The Studio's two tabs, framework-free (the React and Vue Studios share this file; src/sdui
 * stays identical):
 *
 * - **Template** — a shared template: which components a page has, with their defaults (sample
 *   texts in [brackets]). Terbitkan releases it at once; the pages made from it may then be
 *   updated to that release (`pagesToUpdate` / `updatePages`).
 * - **Konten** — a page of a kanal, made from a template release: the SAME editor, its
 *   structure locked; the page sets any prop and action (spec 2.6) and stores only what differs
 *   from the template (`mergePage` / `splitPage`). Terbitkan publishes the page at once.
 */
import { SPEC_VERSION, TemplateDocument, ValueSet, ValuesDocument, sortedJSONStringify } from '@fajekrina/sdui-r'
import { mergePage, placeholders, splitPage } from '@fajekrina/sdui-r/builder'
import { StudioError, studio, type PageRow, type ScreenDetail, type TemplateDetail } from '../api/studio'

type Json = Record<string, unknown>

// ---------------------------------------------------------------- Template tab

/** the template the editor opens: its draft, else its release */
export function templateSource(t: TemplateDetail | null | undefined): Json | undefined {
  return (t?.draft ?? t?.active?.payload ?? undefined) as Json | undefined
}

// the server sets the key and the version of a template draft itself
const design = (doc: unknown): string => {
  const d = doc as { schemaVersion?: unknown; template?: Json }
  return sortedJSONStringify({ schemaVersion: d.schemaVersion, template: { ...d.template, key: undefined, version: undefined } } as never)
}

/** save the template's draft (only when the design changed: an unchanged one starts no new version) */
export async function saveTemplateDraft(key: string, payload: unknown, t: TemplateDetail | null): Promise<TemplateDetail> {
  if (t?.draft && design(t.draft) === design(payload)) return t
  return studio.saveTemplate(key, payload, t?.lockVersion)
}

/**
 * Save, then release the template now. `onSaved` gets the saved draft first, so a failed
 * publish still leaves the Studio on its lock version. Nothing new to release: the release
 * that is live (`unchanged: true`).
 */
export async function publishTemplateDraft(key: string, payload: unknown, t: TemplateDetail | null, onSaved: (saved: TemplateDetail) => void): Promise<{ template: TemplateDetail; unchanged: boolean }> {
  const saved = await saveTemplateDraft(key, payload, t)
  onSaved(saved)
  try {
    return { template: await studio.publishTemplate(key), unchanged: false }
  } catch (e) {
    if (e instanceof StudioError && e.status === 409 && saved.activeVersion) return { template: saved, unchanged: true }
    throw e
  }
}

/** a page made from a template that is not on its latest release, and what updating it drops */
export interface PageUpdate extends PageRow { dropped: string[] }

/**
 * The pages made from `templateKey` that are not on release `version` yet, each with the content
 * it would lose there (what it set on components the release no longer has) — K5: shown before
 * the user picks which pages to update.
 */
export async function pagesToUpdate(templateKey: string, version: number, release: unknown): Promise<PageUpdate[]> {
  const pages = (await studio.pages(templateKey)).filter((p) => p.templateVersion < version)
  const template = TemplateDocument.decode(release)
  return Promise.all(pages.map(async (p) => {
    const detail = await studio.screen(p.kanal, p.key)
    const values = detail.draft ?? detail.active?.payload
    return { ...p, dropped: values ? mergePage(template, ValuesDocument.decode(values)).dropped : [] }
  }))
}

/** the outcome of updating one page to a template release */
export interface PageUpdateResult { kanal: string; key: string; ok: boolean; dropped: string[]; error?: string }

/** carry the chosen pages over to release `version` and publish each at once; one failure stops none of the others */
export async function updatePages(pages: Array<Pick<PageRow, 'kanal' | 'key'>>, version: number): Promise<PageUpdateResult[]> {
  const out: PageUpdateResult[] = []
  for (const p of pages) {
    try {
      const res = await studio.publishScreen(p.kanal, p.key, version)
      out.push({ kanal: p.kanal, key: p.key, ok: true, dropped: res.dropped ?? [] })
    } catch (e) {
      out.push({ kanal: p.kanal, key: p.key, ok: false, dropped: [], error: (e as Error).message })
    }
  }
  return out
}

// ---------------------------------------------------------------- Konten tab

const valuesOf = (page: ScreenDetail | null | undefined, which: 'draft' | 'active' = 'draft'): unknown =>
  which === 'active' ? page?.active?.payload : page?.draft ?? page?.active?.payload

/**
 * The tree the Konten tab opens: the template release with the page's values (its draft, else
 * its release) written in. `dropped`: what the page set on components the release no longer has.
 */
export function pageSource(template: unknown, page: ScreenDetail | null | undefined): { source: Json; dropped: string[] } {
  const values = valuesOf(page)
  const { document, dropped } = mergePage(TemplateDocument.decode(template), values ? ValuesDocument.decode(values) : null)
  return { source: document.toJSON() as Json, dropped }
}

/** what is live: the editor lists the changes against it (none for a page never published) */
export function pageBaseline(template: unknown, page: ScreenDetail | null | undefined): Json | undefined {
  const live = valuesOf(page, 'active')
  if (!live) return undefined
  const ref = (live as { values?: { template?: { version?: number } } }).values?.template?.version
  const t = TemplateDocument.decode(template)
  if (ref !== undefined && ref !== t.template.version) return undefined
  return mergePage(t, ValuesDocument.decode(live)).document.toJSON() as Json
}

const content = (doc: unknown): string => sortedJSONStringify(doc as never)

/** the page's values for the edited tree: only what differs from the template (spec 2.6) */
export function pageValues(key: string, edited: unknown, template: unknown): Json {
  return splitPage(TemplateDocument.decode(edited), TemplateDocument.decode(template), key).toJSON() as Json
}

/** save the page's draft (only when it changed) */
export async function savePage(kanal: string, key: string, edited: unknown, template: unknown, page: ScreenDetail | null): Promise<ScreenDetail | null> {
  const values = pageValues(key, edited, template)
  if (page?.draft && content(page.draft) === content(values)) return page
  return studio.saveScreen(kanal, key, values, page?.lockVersion)
}

/** save, then publish the page now; nothing new: the live page (`unchanged: true`) */
export async function publishPage(kanal: string, key: string, edited: unknown, template: unknown, page: ScreenDetail | null, onSaved: (saved: ScreenDetail | null) => void): Promise<{ page: ScreenDetail; unchanged: boolean }> {
  const saved = await savePage(kanal, key, edited, template, page)
  onSaved(saved)
  try {
    return { page: await studio.publishScreen(kanal, key), unchanged: false }
  } catch (e) {
    if (e instanceof StudioError && e.status === 409 && saved?.activeSequence) return { page: saved, unchanged: true }
    throw e
  }
}

/** a new page of `kanal` from a template release: empty values (it shows the template's samples) */
export async function createPage(kanal: string, key: string, templateKey: string, version: number): Promise<ScreenDetail> {
  const values = new ValuesDocument(SPEC_VERSION, new ValueSet(key, { key: templateKey, version }, {}))
  return studio.saveScreen(kanal, key, values.toJSON())
}

/**
 * Move a page's draft to template release `version` (the Konten tab's "Perbarui"): what it set
 * on components that release still has is kept; the rest is listed in `dropped`. Not published.
 */
export async function rebasePage(kanal: string, key: string, page: ScreenDetail, release: unknown): Promise<{ page: ScreenDetail; dropped: string[] }> {
  const { source, dropped } = pageSource(release, page)
  const saved = await studio.saveScreen(kanal, key, pageValues(key, source, release), page.lockVersion)
  return { page: saved, dropped }
}

/** sample texts of the template still in the page (`[Insight Title]`): the user is warned before publishing */
export function sampleTexts(edited: unknown): string[] {
  return placeholders(TemplateDocument.decode(edited).template.root)
}
