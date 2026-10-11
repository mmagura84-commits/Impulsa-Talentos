import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dictionaries, defaultLocale, loadLocaleDict, type Dict, type Locale } from './translations'

const STORAGE_KEY = 'it_locale'

type Ctx = {
  locale: Locale
  setLocale: (l: Locale) => void
  /** Translation with `{var}` interpolation. Falls back to the key if missing. */
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx | null>(null)

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k]
    return v == null ? `{${k}}` : String(v)
  })
}

function detectInitial(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored === 'en' || stored === 'es' || stored === 'pt') return stored
  } catch {
    // ignore
  }
  // Fall back to browser language
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  const lower = nav.toLowerCase()
  if (lower.startsWith('pt')) return 'pt'
  if (lower.startsWith('es')) return 'es'
  return defaultLocale
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Start on the default locale on BOTH server and client so the first client
  // render matches the prerendered HTML (reading localStorage here caused a
  // hydration mismatch, e.g. "EN" vs "ES" in the language toggle). The saved /
  // browser locale is applied right after hydration.
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [detected, setDetected] = useState(false)
  useEffect(() => {
    const initial = detectInitial()
    if (initial !== defaultLocale) setLocaleState(initial)
    setDetected(true)
  }, [])
  // Non-default dictionaries are async chunks; load on demand (index chunk reduction).
  const [lazyDicts, setLazyDicts] = useState<Partial<Record<Locale, Dict>>>({})
  useEffect(() => {
    let active = true
    if (locale === 'en' || lazyDicts[locale]) return
    loadLocaleDict(locale)
      .then((dict) => {
        if (active) setLazyDicts((prev) => (prev[locale] ? prev : { ...prev, [locale]: dict }))
      })
      .catch(() => {
        /* Loading failed — stay on the EN fallback rather than crashing. */
      })
    return () => {
      active = false
    }
  }, [locale, lazyDicts])

  // Persist + sync <html lang>
  useEffect(() => {
    // Don't persist the pre-detection default over the user's saved choice.
    if (!detected) return
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale
    }
  }, [locale, detected])

  const value = useMemo<Ctx>(() => {
    const dict: Dict = locale === 'en' ? dictionaries.en : (lazyDicts[locale] ?? dictionaries.en)
    const fallback: Dict = dictionaries.en
    return {
      locale,
      setLocale: (l: Locale) => setLocaleState(l),
      t: (key, vars) => {
        const raw = dict[key] ?? fallback[key] ?? key
        return interpolate(raw, vars)
      },
    }
  }, [locale, lazyDicts])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Soft fallback so components that pre-render without the provider still render
    return {
      locale: defaultLocale,
      setLocale: () => {},
      t: (key, vars) => interpolate(dictionaries[defaultLocale][key] ?? key, vars),
    }
  }
  return ctx
}
