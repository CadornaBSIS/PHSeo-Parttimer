import { CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrlEnv || !supabaseAnonKeyEnv) {
  throw new Error(
    "Supabase URL and anon key must be set in environment variables.",
  );
}

const supabaseUrl: string = supabaseUrlEnv;
const supabaseAnonKey: string = supabaseAnonKeyEnv;

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
  const adapter = await cookieAdapter();
  const hdrs = await headers();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: adapter,
    headers: hdrs,
  });
}

export async function createServiceSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  const adapter = await cookieAdapter();
  const hdrs = await headers();
  return createServerClient(supabaseUrl, serviceKey, {
    cookies: adapter,
    headers: hdrs,
  });
}
