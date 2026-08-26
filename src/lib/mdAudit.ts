import { supabase } from '@/lib/supabase'

/**
 * Client-side helper: write a single MD action to the md_audit_log ledger via
 * the SECURITY DEFINER RPC `md_write_audit` (MD-only, binds submitter_id to the
 * caller). Non-blocking / fire-and-forget: audit write failures must never break
 * the primary action (credential submit, message compose, profile save, etc.).
 */
export async function logMdAudit(
  action: string,
  entityType: string,
  entityRef: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await supabase.rpc('md_write_audit', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_ref: entityRef,
      p_metadata: metadata,
    })
  } catch {
    // Audit is best-effort; never throw to the caller.
  }
}
