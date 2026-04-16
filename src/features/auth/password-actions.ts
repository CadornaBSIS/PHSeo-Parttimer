"use server";

import { revalidatePath } from "next/cache";
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from "@/lib/supabase/server";
import { logAudit } from "@/features/audit/log";

type ActionState = { error?: string; success?: string };

function validatePassword(password: string, confirm: string): string | null {
  const trimmed = password.trim();
  if (!trimmed || trimmed.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(trimmed)) return "Password must include at least one lowercase letter.";
  if (!/[A-Z]/.test(trimmed)) return "Password must include at least one uppercase letter.";
  if (!/[0-9]/.test(trimmed)) return "Password must include at least one number.";
  if (!/[^A-Za-z0-9]/.test(trimmed)) return "Password must include at least one symbol.";
  if (password !== confirm) {
    return "Passwords do not match.";
  }
  return null;
}

export async function changeOwnPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const validationError = validatePassword(password, confirm);
  if (validationError) return { error: validationError };

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: "Unauthorized" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  await logAudit({
    action: "password_changed_self",
    target_type: "auth_user",
    target_id: session.user.id,
  });

  revalidatePath("/settings/password");
  return { success: "Password updated." };
}

export async function changeEmployeePasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!employeeId) return { error: "Select an employee." };

  const validationError = validatePassword(password, confirm);
  if (validationError) return { error: validationError };

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { error: "Unauthorized" };

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (currentProfile?.role !== "manager") {
    return { error: "Manager access required" };
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, role, email, full_name")
    .eq("id", employeeId)
    .single();

  if (targetError || !targetProfile) return { error: "Employee not found" };
  if (targetProfile.role !== "employee") {
    return { error: "Only employee passwords can be updated here." };
  }

  const service = await createServiceSupabaseClient();
  const { error } = await service.auth.admin.updateUserById(employeeId, {
    password,
  });
  if (error) return { error: error.message };

  await logAudit({
    action: "employee_password_reset",
    target_type: "profile",
    target_id: employeeId,
    metadata: { email: targetProfile.email },
  });

  revalidatePath("/settings/password");
  return { success: `Password updated for ${targetProfile.full_name}.` };
}
