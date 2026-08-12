import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { useProfile } from '@/hooks/useProfile'

/**
 * App-facing user shape (Supabase `User` adapted to the fields the UI
 * already consumes: id, email, displayName, emailVerified).
 */
export interface AppUser {
  id: string
  email: string | null
  displayName: string
  emailVerified: boolean
}

function toAppUser(u: User): AppUser {
  return {
    id: u.id,
    email: u.email ?? null,
    displayName:
      (u.user_metadata?.displayName as string | undefined) ||
      u.email?.split('@')[0] ||
      '',
    emailVerified: !!u.email_confirmed_at,
  }
}

/**
 * Initial-session restore hardening (flaky-request gap): GoTrue occasionally
 * returns a transient 500 ("Database error finding user") on cold
 * authenticated loads. We retry a bounded number of times with backoff for
 * 5xx / network failures ONLY — never for 4xx (invalid credentials / 401 are
 * deterministic and must surface immediately). When retries are exhausted we
 * resolve the same { data, error } object so the caller keeps the existing
 * loading semantics (no blank page, no error flash — the 3 s safety timeout
 * and onAuthStateChange still carry the flow).
 */
const SESSION_RETRY_DELAYS_MS = [400, 1200]
function isTransientAuthError(err: { status?: number } | null | undefined): boolean {
  if (!err) return false
  const s = err.status ?? 0
  return s === 0 || s >= 500
}
async function fetchSessionWithRetry(): Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>> {
  for (let attempt = 0; ; attempt++) {
    const res = await supabase.auth.getSession()
    if (!res.error || !isTransientAuthError(res.error) || attempt >= SESSION_RETRY_DELAYS_MS.length) {
      return res
    }
    await new Promise((r) => setTimeout(r, SESSION_RETRY_DELAYS_MS[attempt]))
  }
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    /**
     * True once the initial auth state has been resolved (restored
     * session, first SIGNED_IN, or the 3 s safety timeout). Unlike a
     * permanent latch it ONLY gates the safety timeout from clobbering a
     * pending magic-link hash exchange — later SIGNED_IN events are
     * ALWAYS honored (P0: password sign-in after the timeout resolved
     * null used to be dropped, leaving the UI stuck on the login form).
     */
    let loaded = false
    function setAuth(u: AppUser | null) {
      if (!active) return
      setUser(u)
      setIsLoading(false)
    }
    /**
     * getSession() may return null before the magic-link URL hash has been
     * exchanged for a session. If the hash exchange hasn't completed yet we
     * wait for onAuthStateChange to fire instead of flashing the sign-in
     * form. A 3 s safety timeout prevents infinite loading.
     */
    const safety = setTimeout(() => {
      if (!loaded) {
        loaded = true
        setAuth(null)
      }
    }, 3000)
    // Restore the session on mount (refresh token, persisted session). Bounded
    // retry on transient 5xx/network failures (flaky-request gap).
    fetchSessionWithRetry().then(({ data }) => {
      if (!active) return
      if (data.session) {
        loaded = true
        setAuth(toAppUser(data.session.user))
      }
      // If no session, wait for onAuthStateChange — the URL hash
      // may still be processing.
    })
    // Keep in sync with sign-in/sign-out/refresh/token-exchange events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session) {
        // ALWAYS honor a real session — including password/OAuth/magic
        // link sign-in that happens AFTER the safety timeout resolved
        // null. The previous permanent `resolved` latch dropped these.
        loaded = true
        setAuth(toAppUser(session.user))
      } else if (loaded) {
        // SIGNED_OUT / token expiry with no session — clear the user.
        setAuth(null)
      }
      // Else: no session AND hydration not done yet — likely a pending
      // magic-link hash exchange; the safety timeout covers it.
    })
    return () => {
      active = false
      clearTimeout(safety)
      sub.subscription.unsubscribe()
    }
  }, [])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    /** Send a passwordless magic link to an email address. Optionally redirect back to a relative app path after sign-in. */
    sendMagicLink: (email: string, redirectTo?: string) =>
      supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
        },
      }),
    /** Sign in with email + password. */
    signInWithPassword: (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    /** Create an account with email + password. */
    signUpWithPassword: (email: string, password: string, redirectTo?: string) =>
      supabase.auth.signUp({ email, password, options: redirectTo ? { emailRedirectTo: redirectTo } : undefined }),
    /** Sign in with Google OAuth. Requires Google provider configured in Supabase dashboard. */
    signInWithGoogle: (redirectTo?: string) =>
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo ?? (typeof window !== 'undefined' ? window.location.origin + '/employer' : undefined),
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      }),
    /** Sign in with Apple OAuth. Requires Apple provider configured in Supabase dashboard. */
    signInWithApple: (redirectTo?: string) =>
      supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectTo ?? (typeof window !== 'undefined' ? window.location.origin + '/employer' : undefined),
        },
      }),
    /**
     * Sign-in entry point for callers that don't collect an email inline
     * (hero CTAs, mobile menu). Navigates to the AuthGate-protected
     * dashboard, which renders the magic-link form for guests.
     */
    login: () => {
      if (typeof window !== 'undefined') window.location.href = '/dashboard'
    },
    /** Resend email verification to the current user (Supabase built-in). */
    resendVerificationEmail: (email: string, redirectTo?: string) =>
      supabase.auth.resend({
        type: 'signup',
        email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      }),
    logout: () => supabase.auth.signOut(),
  }
}

/** Employer gate: checks whether the current user's profile has role === 'employer'. */
export function useIsEmployer(): boolean {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { data: profile } = useProfile(isAuthenticated && !isLoading ? user?.id : undefined)
  if (!isAuthenticated || isLoading) return false
  return profile?.role === 'employer'
}

/** Admin gate: checks whether the current user's profile has role === 'admin'. */
export function useIsAdmin(): boolean {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { data: profile } = useProfile(isAuthenticated && !isLoading ? user?.id : undefined)
  if (!isAuthenticated || isLoading) return false
  return profile?.role === 'admin'
}

/** Managing director gate: checks whether the current user's profile has role === 'md'. */
export function useIsMd(): boolean {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { data: profile } = useProfile(isAuthenticated && !isLoading ? user?.id : undefined)
  if (!isAuthenticated || isLoading) return false
  return profile?.role === 'md'
}
