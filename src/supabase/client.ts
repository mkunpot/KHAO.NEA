import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from '../config'
import type { Database } from './types'

export { isSupabaseConfigured }

/**
 * Browser client. Only the publishable/anon key ever reaches the browser — never a secret or
 * service_role key. There is no login in this demo, so no auth session is kept.
 */
export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null
