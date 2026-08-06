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
    // Restore the session on mount (refresh token, persisted session).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session ? toAppUser(data.session.user) : null)
      setIsLoading(false)
    })
    // Keep in sync with sign-in/sign-out/refresh events.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? toAppUser(session.user) : null)
      setIsLoading(false)
    })
    return () => {
      active = false
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
    /**
     * Sign-in entry point for callers that don't collect an email inline
     * (hero CTAs, mobile menu). Navigates to the AuthGate-protected
     * dashboard, which renders the magic-link form for guests.
     */
    login: () => {
      if (typeof window !== 'undefined') window.location.href = '/dashboard'
    },
    logout: () => supabase.auth.signOut(),
  }
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
