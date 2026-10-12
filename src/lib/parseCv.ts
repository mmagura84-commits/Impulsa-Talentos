import { supabase } from '@/lib/supabase'

export type CvParseResult = 'ok' | 'no_text' | 'unsupported' | 'error'

/**
 * Ask the parse-cv Edge Function to read an uploaded CV (storage path inside
 * the private `cvs` bucket) and store its text on the candidate's profile for
 * matching. Never throws: a CV that can't be read is still a saved CV.
 */
export async function requestCvParse(path: string): Promise<CvParseResult> {
  try {
    const { error } = await supabase.functions.invoke('parse-cv', { body: { path } })
    if (!error) return 'ok'
    const status = (error as { context?: Response }).context?.status
    if (status === 422) return 'no_text'
    if (status === 415) return 'unsupported'
    return 'error'
  } catch {
    return 'error'
  }
}
