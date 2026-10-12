/**
 * The table helpers from `@/lib/supabase`, loading the supabase-js client the
 * first time one is called instead of at start-up.
 *
 * Route loaders and hooks that are part of every page's start-up bundle
 * (jobs, companies, profiles, auth) import from here, so a page that never
 * touches the database — or reads it another way, like the home page — doesn't
 * download and run the ~200 KB client before it can respond to taps.
 */
type Db = typeof import('./supabase')

export const loadSupabase = (): Promise<Db> => import('./supabase')

const lazy = <K extends 'listRows' | 'getRow' | 'createRow' | 'updateRow' | 'deleteRow' | 'countRows'>(name: K): Db[K] =>
  ((...args: unknown[]) => loadSupabase().then((m) => (m[name] as (...a: unknown[]) => unknown)(...args))) as unknown as Db[K]

export const listRows = lazy('listRows')
export const getRow = lazy('getRow')
export const createRow = lazy('createRow')
export const updateRow = lazy('updateRow')
export const deleteRow = lazy('deleteRow')
export const countRows = lazy('countRows')
