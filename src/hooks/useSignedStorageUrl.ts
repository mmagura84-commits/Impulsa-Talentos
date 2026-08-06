import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Resolve a private cvs object pointer into a short-lived URL for rendering. */
export function useSignedStorageUrl(pointer: string | null | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    if (!pointer) { setUrl(undefined); return }
    if (!pointer.startsWith('storage:cvs:')) { setUrl(pointer); return }
    const path = pointer.slice('storage:cvs:'.length)
    supabase.storage.from('cvs').createSignedUrl(path, 60 * 60).then(({ data, error }) => {
      if (!cancelled) setUrl(error ? undefined : data?.signedUrl)
    })
    return () => { cancelled = true }
  }, [pointer])
  return url
}

/** Convert an object path to the durable pointer stored in application/profile fields. */
export function storagePointer(path: string) { return `storage:cvs:${path}` }
