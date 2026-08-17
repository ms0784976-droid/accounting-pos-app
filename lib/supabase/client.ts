/**
 * lib/supabase/client.ts
 * Supabase client للاستخدام في Client Components فقط
 */
import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Singleton للاستخدام العام في الـ client side
let _client: ReturnType<typeof createClient> | null = null

export function getClient() {
  if (!_client) _client = createClient()
  return _client
}
