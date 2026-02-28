import { createClient } from '@supabase/supabase-js'

// Lazy singleton — created on first access so module evaluation during
// Next.js static pre-rendering doesn't throw when env vars are absent.
let _instance

function getInstance() {
  if (!_instance) {
    _instance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return _instance
}

export const supabase = new Proxy(
  {},
  {
    get(_, prop) {
      const client = getInstance()
      const value = client[prop]
      return typeof value === 'function' ? value.bind(client) : value
    },
  }
)
