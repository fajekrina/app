/**
 * web-bff session: the browser holds only an HttpOnly cookie; this module keeps the CSRF
 * token every write sends (`X-CSRF-Token`). `GET /bff/session` creates a guest session.
 */
let csrf: string | undefined
let user: string | undefined

export async function session(refresh = false): Promise<{ user: string; csrf: string }> {
  if (!csrf || refresh) {
    const res = await fetch('/bff/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`session: HTTP ${res.status}`)
    const body = (await res.json()) as { user: string; csrf: string }
    csrf = body.csrf
    user = body.user
  }
  return { user: user!, csrf: csrf! }
}

/** headers for `fetchNetworkClient({ getHeaders })`: a 401 refreshes the session once */
export async function csrfHeaders({ refresh }: { refresh: boolean }): Promise<Record<string, string>> {
  return { 'X-CSRF-Token': (await session(refresh)).csrf }
}
