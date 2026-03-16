import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Profile } from "@/types/db";

export const getSession = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    return { session: null, supabase };
  }

  return { session, supabase };
});

export const requireSession = cache(async () => {
  const { session, supabase } = await getSession();
  if (!session) redirect("/login");
  return { session, supabase };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const { session, supabase } = await getSession();
  if (!session) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  return data as Profile | null;
});

export const requireProfile = cache(async () => {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
});
