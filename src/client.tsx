import { StrictMode, startTransition } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

const hasSsrContent = () => {
  for (const node of document.body.childNodes) {
    if (node.nodeType === 1 && (node as Element).tagName !== 'SCRIPT') return true
  }
  return false
}

startTransition(() => {
  for (const script of Array.from(document.body.querySelectorAll('script'))) {
    script.remove()
  }
  if (hasSsrContent()) {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  } else {
    // Neutral SPA shell: the body is empty by construction (bootstrap scripts
    // self-remove) — render fresh instead of hydrating, so React never
    // compares the shell's DOM against the route tree (no #418 possible).
    createRoot(document.body).render(
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  }
})
