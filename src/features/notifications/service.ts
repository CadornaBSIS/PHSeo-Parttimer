"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createNotification(params: {
  user_id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  await supabase.from("notifications").insert({
    user_id: params.user_id,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link ?? null,
  });
}

export async function markNotificationRead(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", session.user.id);
}
