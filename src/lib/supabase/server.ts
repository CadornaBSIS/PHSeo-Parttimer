import { CookieOptions, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

function getSupabasePublicConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase URL and anon key must be set in environment variables.",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function cookieAdapter() {
  const store = await cookies();
  return {
    get(name: string) {
      return store.get(name)?.value;
    },
    set(name: string, value: string, options: CookieOptions) {
      try {
        store.set({
          name,
          value,
          ...options,
        });
      } catch {
        // noop for read-only contexts (RSC)
      }
    },
    remove(name: string, options: CookieOptions) {
      try {
        store.set({
          name,
          value: "",
          ...options,
          maxAge: 0,
        });
      } catch {
        // noop
      }
    },
  };
}

export async function createServerSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicConfig();
  const adapter = await cookieAdapter();
  const hdrs = await headers();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: adapter,
    headers: hdrs,
  });
}

export async function createServiceSupabaseClient() {
  const { supabaseUrl } = getSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
