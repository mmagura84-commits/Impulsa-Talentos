import { BrandMark } from '@/components/BrandMark'
import { Link } from '@tanstack/react-router'
import { LanguageToggle } from '@/components/LanguageToggle'
import { PublicHeader } from '@/components/PublicHeader'

export interface LegalSection { title: string; body: string }

/** Shared layout for the Terms and Privacy pages. Lives outside src/routes so
 * the route files export only `Route` and stay code-split. */
export function LegalShell({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <><PublicHeader transparentOnTop={false} /><div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border sticky top-0 bg-background/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" aria-label="Impulsa Talentos"><BrandMark withWordmark className="h-8" /></Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
          </div>
        </div>
      </header>
      <main id="main" className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="font-serif text-3xl font-bold mb-1">{title}</h1>
        <p className="text-xs text-muted-foreground mb-6">{updated}</p>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{intro}</p>
        <div className="space-y-6">
          {sections.map(s => (
            <section key={s.title}>
              <h2 className="font-semibold text-base mb-1.5">{s.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
      <footer className="border-t border-border py-6 px-5 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Impulsa Talentos. Medellín, Colombia.
        </p>
      </footer>
    </div></>
  )
}
