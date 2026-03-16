"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

type AuditPayload = {
  action: string;
  target_type: string;
  target_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAudit(payload: AuditPayload) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const actorId = session?.user.id ?? null;

  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action: payload.action,
    target_type: payload.target_type,
    target_id: payload.target_id ?? null,
    metadata: payload.metadata ?? {},
  });
}
