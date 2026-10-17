/**
 * Google's own "Sign in with Google" button (Google Identity Services).
 *
 * Why not the OAuth redirect: that flow sends people through
 * <project>.supabase.co, and Google's consent screen shows that host name.
 * With Identity Services the popup is tied to THIS site's origin
 * (impulsatalentos.expert, registered as an authorized JavaScript origin on the
 * OAuth client), and the Google ID token is exchanged with Supabase through
 * signInWithIdToken. No paid Supabase custom domain is needed.
 *
 * It degrades on its own: if Google's script is blocked or fails to load,
 * `onUnavailable` fires and the caller keeps its existing redirect button.
 * The nonce is generated per page load; Google gets the SHA-256 of it, Supabase
 * gets the raw value, so a stolen ID token cannot be replayed.
 */
import { useEffect, useRef } from 'react'

const CLIENT_ID = '877736236802-2uc6piae3fluksabuf67t91t9279ug1a.apps.googleusercontent.com'
const GSI_SRC = 'https://accounts.google.com/gsi/client'

type GsiWindow = Window & {
  google?: {
    accounts: {
      id: {
        initialize: (c: Record<string, unknown>) => void
        renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null
function loadGsi(): Promise<void> {
  if ((window as GsiWindow).google?.accounts?.id) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; reject(new Error('gsi blocked')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

async function makeNonce() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}

export function GoogleSignInButton({
  onCredential,
  onUnavailable,
  onReady,
  text = 'continue_with',
  locale = 'en',
}: {
  /** Called with Google's ID token and the raw nonce. */
  onCredential: (idToken: string, rawNonce: string) => void
  onUnavailable: () => void
  onReady?: () => void
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  locale?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const cb = useRef({ onCredential, onUnavailable, onReady })
  cb.current = { onCredential, onUnavailable, onReady }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!crypto?.subtle) throw new Error('no webcrypto')
        await loadGsi()
        const nonce = await makeNonce()
        if (cancelled || !box.current) return
        const gid = (window as GsiWindow).google!.accounts.id
        gid.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hashed,
          callback: (r: { credential?: string }) => { if (r.credential) cb.current.onCredential(r.credential, nonce.raw) },
          ux_mode: 'popup',
          use_fedcm_for_prompt: true,
          itp_support: true,
        })
        gid.renderButton(box.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
          text, logo_alignment: 'left', locale,
          width: Math.min(400, Math.max(200, Math.round(box.current.getBoundingClientRect().width || 320))),
        })
        cb.current.onReady?.()
      } catch {
        if (!cancelled) cb.current.onUnavailable()
      }
    })()
    return () => { cancelled = true }
  }, [text, locale])

  return <div ref={box} className="flex min-h-11 w-full justify-center" />
}
