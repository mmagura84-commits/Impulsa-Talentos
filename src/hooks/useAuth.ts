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

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    /** Once this flips to true, the auth state is final — no more loading. */
    let resolved = false

    function resolve(u: AppUser | null) {
      if (!active || resolved) return
      resolved = true
      setUser(u)
      setIsLoading(false)
    }

    /**
     * getSession() may return null before the magic-link URL hash has been
     * exchanged for a session. If the hash exchange hasn't completed yet we
     * wait for onAuthStateChange to fire instead of flashing the sign-in
     * form. A 3 s safety timeout prevents infinite loading.
     */
    const safety = setTimeout(() => {
      if (!resolved) resolve(null)
    }, 3000)

    // Restore the session on mount (refresh token, persisted session).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolve(toAppUser(data.session.user))
      }
      // If no session, wait for onAuthStateChange — the URL hash
      // may still be processing.
    })

    // Keep in sync with sign-in/sign-out/refresh/token-exchange events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        resolve(toAppUser(session.user))
      } else if (!resolved) {
        // No session AND no pending hash — genuinely unauthenticated.
        resolve(null)
      }
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
    signUpWithPassword: (email: string, password: string, redirectTo?: string, fullName?: string) =>
      supabase.auth.signUp({ email, password, options: { ...(redirectTo ? { emailRedirectTo: redirectTo } : {}), ...(fullName ? { data: { full_name: fullName } } : {}) } }),
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
