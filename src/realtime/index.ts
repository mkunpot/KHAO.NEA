import { isSupabaseConfigured, supabase } from '../supabase/client'
import type { RealtimeAdapter } from './RealtimeAdapter'
import { SupabaseRealtimeAdapter } from './SupabaseRealtimeAdapter'

export { isSupabaseConfigured }
export type { RealtimeAdapter } from './RealtimeAdapter'

let adapter: RealtimeAdapter | null | undefined

/** The app-wide adapter, or null when Supabase is not configured (classroom features are then unavailable). */
export function getRealtimeAdapter(): RealtimeAdapter | null {
  if (adapter === undefined) adapter = supabase ? new SupabaseRealtimeAdapter(supabase) : null
  return adapter
}
