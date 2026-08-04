import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Briefcase, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nProvider'

export function PublicHeader({ transparentOnTop = true }: { transparentOnTop?: boolean }) {
  const { t } = useI18n(); const { user, isLoading } = useAuth(); const location = useLocation()
  const [scrolled, setScrolled] = useState(!transparentOnTop); const [open, setOpen] = useState(false)
  useEffect(() => { if (!transparentOnTop) return; const fn=()=>setScrolled(window.scrollY>24); fn(); window.addEventListener('scroll',fn,{passive:true}); return ()=>window.removeEventListener('scroll',fn) }, [transparentOnTop])
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => { const fn=(e:KeyboardEvent)=>e.key==='Escape'&&setOpen(false); window.addEventListener('keydown',fn); return ()=>window.removeEventListener('keydown',fn) }, [])
  const nav = [{to:'/jobs',label:t('nav.jobs'), match:location.pathname.startsWith('/jobs')},{to:'/companies',label:t('nav.companies'),match:location.pathname.startsWith('/companies')},{to:'/dashboard',label:t('nav.forEmployers'),match:/^\/(dashboard|candidate|employer|hq)/.test(location.pathname)},{to:'/pricing',label:t('nav.pricing'),match:location.pathname.startsWith('/pricing')}]
  const cls=(active:boolean)=>`rounded-sm px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/80 ${active?'font-semibold text-white underline decoration-accent decoration-2 underline-offset-8':'text-white/80 hover:text-white'}`
  return <header className={`sticky top-0 z-40 w-full border-b transition-colors duration-300 ${scrolled?'border-white/15 bg-gradient-to-b from-[#1f3a8a] to-[#16306e] shadow-[0_4px_20px_rgba(0,0,0,0.25)]':'border-transparent bg-transparent'}`}>
    <div className="mx-auto flex h-16 w-full max-w-[88rem] items-center justify-between gap-4 px-5 lg:px-10"><Link to="/" className="flex items-center gap-2"><BrandMark className="size-8 rounded-lg" title={t('brand.name')} /><span className="hidden text-lg font-bold text-white sm:block">Impulsa Talentos</span></Link>
      <nav className="hidden items-center gap-4 md:flex" aria-label="Main navigation"><Link to="/jobs" aria-current={nav[0].match?'page':undefined} className={cls(nav[0].match)}>{nav[0].label}</Link><Link to="/companies" aria-current={nav[1].match?'page':undefined} className={cls(nav[1].match)}>{nav[1].label}</Link><span aria-hidden className="mx-2 h-5 w-px bg-white/20" />{nav.slice(2).map(n=><Link key={n.to} to={n.to} aria-current={n.match?'page':undefined} className={cls(n.match)}>{n.label}</Link>)}</nav>
      <div className="flex items-center gap-2"><LanguageToggle compact className="text-white/80 hover:bg-white/10 hover:text-white" />{isLoading?<div className="h-9 w-24 animate-pulse rounded-md bg-white/15" />:user?<Button asChild variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/10 hover:text-white"><Link to="/dashboard"><Briefcase className="size-4" />{t('landing.dashboard')}</Link></Button>:<Button asChild variant="outline" size="sm" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/dashboard">{t('landing.signIn')}</Link></Button>}<button type="button" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} aria-controls="mobile-nav-panel" onClick={()=>setOpen(!open)} className="inline-flex size-10 items-center justify-center rounded-md text-white hover:bg-white/10 md:hidden">{open?<X className="size-5"/>:<Menu className="size-5"/>}</button></div>
    </div>{open&&<div id="mobile-nav-panel" className="border-t border-white/10 bg-gradient-to-b from-[#1f3a8a] to-[#16306e] px-5 pb-5 pt-2 md:hidden"><nav className="flex flex-col gap-1" aria-label="Mobile navigation">{nav.map(n=><Link key={n.to} to={n.to} aria-current={n.match?'page':undefined} onClick={()=>setOpen(false)} className={`flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${n.match?'text-white underline decoration-accent decoration-2 underline-offset-4':'text-white/85 hover:bg-white/10 hover:text-white'}`}>{n.label}</Link>)}</nav></div>}
  </header>
}
