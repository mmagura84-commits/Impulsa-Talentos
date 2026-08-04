/**
 * Impulsa Talentos — Brand mark + wordmark.
 * Renders as inline SVG so it inherits `currentColor` and works at any size.
 * Typography matches the hero h1 (Lora, 700) so the wordmark reads as a
 * peer of the headline, not body copy.
 */
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
  /** When true, renders the full wordmark (mark + text) instead of just the mark. */
  withWordmark?: boolean
  /** Title for screen readers. */
  title?: string
}

export function BrandMark({ className, withWordmark = false, title }: BrandMarkProps) {
  if (withWordmark) {
    return (
      <span className={cn('inline-flex items-center gap-2.5 shrink-0', className)}>
        <svg
          viewBox="0 0 44 44"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="size-8 shrink-0"
        >
          <defs>
            <linearGradient id="bm-grad" x1="6" y1="38" x2="38" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1f3a8a" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="bm-accent" x1="20" y1="6" x2="20" y2="14" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <rect width="44" height="44" rx="11" fill="url(#bm-grad)" />
          {/* Concentric pulse arcs — talent radiating outward */}
          <path d="M7 16 A15 15 0 0 1 37 16" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.35" fill="none" strokeLinecap="round" />
          <path d="M10 19 A12 12 0 0 1 34 19" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
          {/* Upward chevron (impulse / launch) */}
          <path d="M13 33 L22 16 L31 33" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Apex dot — the talent being launched */}
          <circle cx="22" cy="16" r="2.5" fill="url(#bm-accent)" />
        </svg>
        {title ? <span className="sr-only">{title}</span> : null}
        <span className="font-serif font-bold text-2xl tracking-tight text-foreground whitespace-nowrap">
          <span>Impulsa</span>
          <span className="text-primary"> Talentos</span>
        </span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0',
        className,
      )}
    >
      <svg
        viewBox="0 0 44 44"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="size-full"
      >
        <defs>
          <linearGradient id="bm-mark-only" x1="6" y1="38" x2="38" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#facc15" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        {/* Pulse arcs */}
        <path d="M7 16 A15 15 0 0 1 37 16" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.35" fill="none" strokeLinecap="round" />
        <path d="M10 19 A12 12 0 0 1 34 19" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
        {/* Chevron + dot */}
        <path d="M13 33 L22 16 L31 33" stroke="url(#bm-mark-only)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="22" cy="16" r="2.5" fill="#facc15" />
      </svg>
      {title ? <span className="sr-only">{title}</span> : null}
    </span>
  )
}
