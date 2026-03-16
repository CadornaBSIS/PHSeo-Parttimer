"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CookieSetOptions = Omit<Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[0], "name" | "value">;

async function createActionClient() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieSetOptions) {
        cookieStore.set({ name, value, ...(options ?? {}) });
      },
      remove(name: string, options?: CookieSetOptions) {
        cookieStore.set({ name, value: "", ...(options ?? {}), maxAge: 0 });
      },
    },
    headers: hdrs,
  });
}

type ActionState = { error?: string; success?: string };

export async function signInAction(_prevState: ActionState, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createActionClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createActionClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function sendResetPassword(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createActionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/login`,
  });

  if (error) return { error: error.message };
  return { success: "Password reset email sent if the account exists." };
}
