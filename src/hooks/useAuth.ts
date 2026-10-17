import { useState, useEffect } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useProfile } from '@/hooks/useProfile'
import { loadSupabase } from '@/lib/db'

/* supabase-js is loaded on demand: right away when this browser may hold a
   session (or the URL carries a sign-in/recovery/OAuth return), otherwise only
   when someone signs in. Signed-out visitors on public pages never download
   it, and the page responds to taps sooner. Every useAuth instance subscribes
   to auth changes as soon as the client is loaded, wherever that started. */
let clientPromise: Promise<SupabaseClient> | null = null
const clientWaiters = new Set<(c: SupabaseClient) => void>()
function ensureClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = loadSupabase().then((m) => m.supabase)
    void clientPromise.then((c) => clientWaiters.forEach((fn) => fn(c)))
  }
  return clientPromise
}
/** Might this browser be signed in (or finishing a sign-in)? */
function mayHaveSession(): boolean {
  if (typeof window === 'undefined') return false
  const { hash, search } = window.location
  if (/access_token=|refresh_token=|error_description=|type=(recovery|signup|invite|magiclink)/.test(hash)) return true
  if (/[?&](code|token_hash)=/.test(search)) return true
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i) ?? ''
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) return true
    }
    return false
  } catch {
    return true // storage unreadable: check properly
  }
}

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
/**
 * Team invites are rows keyed by the invitee's email (migration 041). Bind any
 * pending invite to this account once per page session after sign-in.
 */
const invitesAccepted = new Set<string>()
function acceptTeamInvitesOnce(supabase: SupabaseClient, userId: string) {
  if (typeof window === 'undefined' || invitesAccepted.has(userId)) return
  invitesAccepted.add(userId)
  void supabase.rpc('accept_team_invites').then(({ data }) => {
    if (typeof data === 'number' && data > 0) {
      // A new seat changes which company and jobs this person sees.
      window.dispatchEvent(new CustomEvent('impulsa:team-invite-accepted', { detail: data }))
    }
  })
}

async function fetchSessionWithRetry(supabase: SupabaseClient): Promise<Awaited<ReturnType<SupabaseClient['auth']['getSession']>>> {
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
     * pending recovery/confirmation hash exchange (password-reset and
     * email-confirm links also arrive as URL hash tokens) — later
     * SIGNED_IN events are ALWAYS honored (P0: password sign-in after
     * the timeout resolved null used to be dropped, leaving the UI stuck
     * on the login form).
     */
    let loaded = false
    function setAuth(u: AppUser | null) {
      if (!active) return
      setUser(u)
      setIsLoading(false)
    }
    /**
     * getSession() may return null before the recovery/confirmation URL
     * hash has been exchanged for a session. If the hash exchange hasn't
     * completed yet we wait for onAuthStateChange to fire instead of
     * flashing the sign-in form. A 3 s safety timeout prevents infinite
     * loading.
     */
    let unsubscribe = () => {}
    let safety: ReturnType<typeof setTimeout> | undefined
    function connect(supabase: SupabaseClient) {
      if (!active) return
      // Restore the session (refresh token, persisted session). Bounded retry
      // on transient 5xx/network failures (flaky-request gap).
      fetchSessionWithRetry(supabase).then(({ data }) => {
        if (!active) return
        if (data.session) {
          loaded = true
          setAuth(toAppUser(data.session.user))
          acceptTeamInvitesOnce(supabase, data.session.user.id)
        }
        // If no session, wait for onAuthStateChange — the URL hash
        // may still be processing.
      })
      // Keep in sync with sign-in/sign-out/refresh/token-exchange events.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return
        if (session) {
          // ALWAYS honor a real session — including password/OAuth sign-in
          // that happens AFTER the safety timeout resolved null.
          loaded = true
          setAuth(toAppUser(session.user))
          acceptTeamInvitesOnce(supabase, session.user.id)
        } else if (loaded) {
          // SIGNED_OUT / token expiry with no session — clear the user.
          setAuth(null)
        }
        // Else: no session AND hydration not done yet — likely a pending
        // recovery/confirmation hash exchange; the safety timeout covers it.
      })
      unsubscribe = () => sub.subscription.unsubscribe()
    }
    if (mayHaveSession()) {
      // getSession() may return null before a recovery/confirmation URL hash
      // has been exchanged; wait for onAuthStateChange, with a 3 s safety
      // timeout against infinite loading.
      safety = setTimeout(() => {
        if (!loaded) {
          loaded = true
          setAuth(null)
        }
      }, 3000)
      void ensureClient().then(connect)
    } else {
      // Nothing saved: signed out. Subscribe once the client loads for any
      // reason (e.g. a sign-in from a form on this page).
      loaded = true
      setAuth(null)
      if (clientPromise) void clientPromise.then(connect)
      else clientWaiters.add(connect)
    }
    return () => {
      active = false
      clearTimeout(safety)
      clientWaiters.delete(connect)
      unsubscribe()
    }
  }, [])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    /** Sign in with email + password. */
    signInWithPassword: (email: string, password: string) =>
      ensureClient().then((supabase) => supabase.auth.signInWithPassword({ email, password })),
    /**
     * Create an account with email + password. `details` travel as auth
     * metadata: `locale` (site language → email language, migration 042) and
     * the sign-up choices `role`, `full_name`, `data_consent`,
     * `marketing_consent`, from which the database creates the profile at once
     * (migration 043).
     */
    signUpWithPassword: (email: string, password: string, redirectTo?: string, details?: Record<string, string | boolean>) =>
      ensureClient().then((supabase) => supabase.auth.signUp({
        email,
        password,
        options: {
          ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
          ...(details ? { data: details } : {}),
        },
      })),
    /** Sign in with Google OAuth. Requires Google provider configured in Supabase dashboard. */
    signInWithGoogle: (redirectTo?: string) =>
      ensureClient().then((supabase) => supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo ?? (typeof window !== 'undefined' ? window.location.origin + '/employer' : undefined),
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })),
    /** Sign in with a Google ID token from Google Identity Services (see GoogleSignInButton). */
    signInWithGoogleIdToken: (token: string, nonce: string) =>
      ensureClient().then((supabase) => supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })),
    /** Sign in with Apple OAuth. Requires Apple provider configured in Supabase dashboard. */
    signInWithApple: (redirectTo?: string) =>
      ensureClient().then((supabase) => supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectTo ?? (typeof window !== 'undefined' ? window.location.origin + '/employer' : undefined),
        },
      })),
    /**
     * Sign-in entry point for callers that don't collect an email inline
     * (hero CTAs, mobile menu). Navigates to the AuthGate-protected
     * dashboard, which renders the password sign-in form for guests.
     */
    login: () => {
      if (typeof window !== 'undefined') window.location.href = '/dashboard'
    },
    /** Resend email verification to the current user (Supabase built-in). */
    resendVerificationEmail: (email: string, redirectTo?: string) =>
      ensureClient().then((supabase) => supabase.auth.resend({
        type: 'signup',
        email,
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })),
    logout: () => ensureClient().then((supabase) => supabase.auth.signOut()),
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
