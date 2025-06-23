import { createClient } from '@supabase/supabase-js'

// Ensure your .env file (or environment variables in deployment) has these:
// VITE_SUPABASE_URL=your_supabase_url
// VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.');
  // You could throw an error here to prevent the app from running without proper config
  // throw new Error('Supabase URL or Anon Key is missing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
