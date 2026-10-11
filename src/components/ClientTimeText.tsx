import { useEffect, useState } from 'react'

/**
 * Renders time-relative text ("3 days ago") only after mount.
 *
 * Public pages are prerendered at build time, so anything computed from
 * `Date.now()` during render differs between the prerendered HTML and the
 * browser once a day boundary has passed — a hydration mismatch that makes
 * React throw away and rebuild the subtree. Rendering an empty string on the
 * server and on the first client render keeps them identical; the real value
 * fills in on the next tick.
 */
export function ClientTimeText({ compute, className }: { compute: () => string; className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <span className={className}>{mounted ? compute() : ''}</span>
}
