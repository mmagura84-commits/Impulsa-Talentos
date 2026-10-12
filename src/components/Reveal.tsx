import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Scroll reveal that never hides content in the prerendered page: everything
 * is visible before — and without — JavaScript, so a page is readable the
 * moment it arrives and its main heading or image counts as painted then.
 *
 * Once the app is running, only sections still below the screen are hidden and
 * fade in as they scroll into view; whatever is already on screen is left
 * alone (no flash), as is anything under "reduce motion".
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'static' | 'waiting' | 'shown'>('static')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setState('waiting')
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setState('shown'); io.disconnect() }
    }, { rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={state === 'static' ? undefined : { transitionDelay: `${delay}s` }}
      className={`${className ?? ''} ${state === 'static' ? '' : 'transition-[opacity,transform] duration-[450ms] ease-[cubic-bezier(0.25,0.1,0.25,1)]'} ${state === 'waiting' ? 'translate-y-3 opacity-0' : ''}`.trim()}
    >
      {children}
    </div>
  )
}
