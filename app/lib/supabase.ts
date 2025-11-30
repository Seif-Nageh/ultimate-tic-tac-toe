import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a placeholder client that will be properly initialized at runtime
let supabase: SupabaseClient;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  // During build time or when env vars are missing, create a dummy client
  // This will fail at runtime if env vars are not set, which is the desired behavior
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };
