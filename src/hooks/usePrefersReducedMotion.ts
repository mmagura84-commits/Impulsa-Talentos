import { useEffect, useState } from 'react'

/**
 * True when the visitor asked the system for reduced motion. Starts false on
 * both the server and the first browser render (so hydration matches the
 * prerendered HTML), then follows the media query.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduce(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduce
}
