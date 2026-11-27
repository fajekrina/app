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
 *
 * Spec 2.8 languages: both tabs edit one language at a time (`language`; '' = the document's
 * default). In another language only what differs from the default texts is stored, in the
 * document's `locales` (`mergePageIn` / `splitPageIn` / `splitTemplateIn`); saving the default
 * texts keeps the languages as they were.
 */
import { SPEC_VERSION, TemplateDocument, ValueSet, ValuesDocument, sortedJSONStringify } from '@fajekrina/sdui-r'
import { languagesOf, mergePage, mergePageIn, placeholders, splitPage, splitPageIn, splitTemplateIn } from '@fajekrina/sdui-r/builder'
import { StudioError, studio, type PageRow, type ScreenDetail, type TemplateDetail } from '../api/studio'

type Json = Record<string, unknown>

// ---------------------------------------------------------------- Template tab

/** the template the editor opens: its draft, else its release; in `language`, that language's texts */
export function templateSource(t: TemplateDetail | null | undefined, language = ''): Json | undefined {
  const doc = (t?.draft ?? t?.active?.payload ?? undefined) as Json | undefined
  if (!doc || !language) return doc
  return TemplateDocument.decode(doc).inLanguage(language).toJSON() as Json
}

/** the languages a document has texts for besides its default, and its default ('id' when it names none) */
export function documentLanguages(doc: unknown): { default: string; others: string[] } {
  if (!doc) return { default: DEFAULT_LANGUAGE, others: [] }
  const d = doc as { template?: unknown; values?: unknown }
  const decoded = d.template !== undefined ? TemplateDocument.decode(doc) : ValuesDocument.decode(doc)
  const own = decoded instanceof TemplateDocument ? decoded.template.language : decoded.values.language
  return { default: own ?? DEFAULT_LANGUAGE, others: languagesOf(decoded) }
}

/** the language of a document that names none (the services' `sdui.language.default`) */
export const DEFAULT_LANGUAGE = 'id'

/**
 * What the Template tab saves: in `language`, the template with that language's texts in its
 * `locales` (what differs from the defaults); in the default language, the edited template with
 * the languages it had.
 */
export function templatePayload(edited: unknown, t: TemplateDetail | null | undefined, language = ''): unknown {
  const current = (t?.draft ?? t?.active?.payload ?? undefined) as Json | undefined
  if (!current) return edited
  const before = TemplateDocument.decode(current)
  if (language) return splitTemplateIn(TemplateDocument.decode(edited), before, language).toJSON()
  const out = edited as { template: Json }
  const tail: Json = {}
  if (before.template.language !== undefined) tail.language = before.template.language
  const locales = (before.toJSON().template as Json).locales
  if (locales !== undefined) tail.locales = locales
  return { ...out, template: { ...out.template, ...tail } }
}

// the server sets the key and the version of a template draft itself; `schemaVersion` is not the
// design either (a newer minor only adds props, so an unchanged 2.6 template is not released again)
const design = (doc: unknown): string => {
  const d = doc as { template?: Json }
  return sortedJSONStringify({ template: { ...d.template, key: undefined, version: undefined } } as never)
}

/** save the template's draft (only when the design changed: an unchanged one starts no new version) */
export async function saveTemplateDraft(key: string, edited: unknown, t: TemplateDetail | null, language = ''): Promise<TemplateDetail> {
  const payload = templatePayload(edited, t, language)
  if (t?.draft && design(t.draft) === design(payload)) return t
  return studio.saveTemplate(key, payload, t?.lockVersion)
}

/**
 * Save, then release the template now. `onSaved` gets the saved draft first, so a failed
 * publish still leaves the Studio on its lock version. Nothing new to release: the release
 * that is live (`unchanged: true`).
 */
export async function publishTemplateDraft(key: string, payload: unknown, t: TemplateDetail | null, onSaved: (saved: TemplateDetail) => void, language = ''): Promise<{ template: TemplateDetail; unchanged: boolean }> {
  const saved = await saveTemplateDraft(key, payload, t, language)
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
export function pageSource(template: unknown, page: ScreenDetail | null | undefined, language = ''): { source: Json; dropped: string[] } {
  const values = valuesOf(page)
  const t = TemplateDocument.decode(template)
  const v = values ? ValuesDocument.decode(values) : null
  const { document, dropped } = language ? mergePageIn(t, v, language) : mergePage(t, v)
  return { source: document.toJSON() as Json, dropped }
}

/** what is live: the editor lists the changes against it (none for a page never published) */
export function pageBaseline(template: unknown, page: ScreenDetail | null | undefined, language = ''): Json | undefined {
  const live = valuesOf(page, 'active')
  if (!live) return undefined
  const ref = (live as { values?: { template?: { version?: number } } }).values?.template?.version
  const t = TemplateDocument.decode(template)
  if (ref !== undefined && ref !== t.template.version) return undefined
  const v = ValuesDocument.decode(live)
  return (language ? mergePageIn(t, v, language) : mergePage(t, v)).document.toJSON() as Json
}

/// what a page holds, for "did it change": its values without `schemaVersion` — a newer minor only adds
/// props (spec 2.7), so a page stored as 2.6 whose values are the same is not saved again
const content = (doc: unknown): string => sortedJSONStringify({ ...(doc as object), schemaVersion: undefined } as never)

/**
 * The page's values for the edited tree: only what differs from the template (spec 2.6). In
 * `language`: the default texts as they were, and what differs from them in `locales[language]`
 * (spec 2.8); in the default language the page keeps its languages.
 */
export function pageValues(key: string, edited: unknown, template: unknown, page?: ScreenDetail | null, language = ''): Json {
  const current = valuesOf(page)
  const before = current ? ValuesDocument.decode(current) : null
  const e = TemplateDocument.decode(edited)
  const t = TemplateDocument.decode(template)
  if (language && before) return splitPageIn(e, t, before, language).toJSON() as Json
  if (language) return splitPageIn(e, t, splitPage(t, t, key), language).toJSON() as Json
  return splitPage(e, t, key, before).toJSON() as Json
}

/** save the page's draft (only when it changed) */
export async function savePage(kanal: string, key: string, edited: unknown, template: unknown, page: ScreenDetail | null, language = ''): Promise<ScreenDetail | null> {
  const values = pageValues(key, edited, template, page, language)
  if (page?.draft && content(page.draft) === content(values)) return page
  return studio.saveScreen(kanal, key, values, page?.lockVersion)
}

/** save, then publish the page now; nothing new: the live page (`unchanged: true`) */
export async function publishPage(kanal: string, key: string, edited: unknown, template: unknown, page: ScreenDetail | null, onSaved: (saved: ScreenDetail | null) => void, language = ''): Promise<{ page: ScreenDetail; unchanged: boolean }> {
  const saved = await savePage(kanal, key, edited, template, page, language)
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
