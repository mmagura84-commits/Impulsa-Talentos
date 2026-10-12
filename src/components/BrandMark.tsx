/**
 * Impulsa Talentos — Spark logo.
 *
 * - `withWordmark`: the lowercase "impulsa / talentos" wordmark whose i carries
 *   a gold spark. Inherits `currentColor`, so set the colour with a text class
 *   (navy by default, `text-white` on the blue header). Size it by height.
 * - Mark only: the i + spark on the brand-blue tile (app icon, tight spots).
 *   Round it with the usual `rounded-*` class.
 *
 * Shapes are outlined paths (see brandPaths.ts), so the logo renders the same
 * before any web font has loaded.
 */
import { cn } from '@/lib/utils'
import {
  BRAND_GOLD, BRAND_TILE, ICON_I, ICON_SPARK, ICON_SPARK_STROKE, ICON_TRANSFORM,
  WORDMARK_SPARK, WORDMARK_SPARK_STROKE, WORDMARK_TAG, WORDMARK_VIEWBOX, WORDMARK_WORD,
} from '@/components/brandPaths'

interface BrandMarkProps {
  className?: string
  /** When true, renders the full wordmark instead of the square mark. */
  withWordmark?: boolean
  /** Accessible name; when omitted the logo is decorative. */
  title?: string
}

const [, , VB_W, VB_H] = WORDMARK_VIEWBOX.split(' ').map(Number)

export function BrandMark({ className, withWordmark = false, title }: BrandMarkProps) {
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true }

  if (withWordmark) {
    return (
      <svg
        viewBox={WORDMARK_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
        className={cn('block h-8 w-auto shrink-0 text-[#14296b] dark:text-white', className)}
        style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
        {...a11y}
      >
        <path d={WORDMARK_WORD} fill="currentColor" />
        <path d={WORDMARK_TAG} fill="currentColor" fillOpacity={0.74} />
        <path d={WORDMARK_SPARK} fill={BRAND_GOLD} stroke={BRAND_GOLD} strokeWidth={WORDMARK_SPARK_STROKE} strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <span className={cn('inline-flex shrink-0 overflow-hidden rounded-md', className)} {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}>
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="size-full">
        <rect width="48" height="48" fill={BRAND_TILE} />
        <g transform={ICON_TRANSFORM}>
          <path d={ICON_I} fill="#ffffff" />
          <path d={ICON_SPARK} fill={BRAND_GOLD} stroke={BRAND_GOLD} strokeWidth={ICON_SPARK_STROKE} strokeLinejoin="round" />
        </g>
      </svg>
    </span>
  )
}
