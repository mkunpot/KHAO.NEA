/** Build-time configuration, readable without pulling in the Supabase client. */
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
// Supabase's newer dashboard calls it the "publishable" key; the spec's name is ANON_KEY. Either works.
export const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

/** False until .env.local holds a project URL and a publishable (anon) key. Self-Study works regardless. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)
