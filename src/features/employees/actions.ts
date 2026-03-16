"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { logAudit } from "@/features/audit/log";

type EmployeeForm = {
  full_name: string;
  email: string;
  department?: string;
  employee_code?: string;
  status?: string;
  role?: "manager" | "employee";
  password?: string;
};

export async function createEmployeeAction(
  form: EmployeeForm,
): Promise<{ error?: string; success?: string; tempPassword?: string }> {
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

  const service = await createServiceSupabaseClient();

  const password =
    form.password && form.password.trim().length >= 8
      ? form.password.trim()
      : // simple strong-ish fallback
        Math.random().toString(36).slice(-8) + "Aa1!";

  const { data: user, error: createError } = await service.auth.admin.createUser(
    {
      email: form.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: form.full_name,
        role: "employee",
      },
    },
  );
  if (createError || !user?.user) {
    return { error: createError?.message ?? "Failed to create auth user" };
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: user.user.id,
    full_name: form.full_name,
    email: form.email,
    role: form.role ?? "employee",
    department: form.department ?? null,
    employee_code: form.employee_code ?? null,
    status: form.status ?? "active",
  });
  if (profileError) {
    return { error: profileError.message };
  }

  await logAudit({
    action: "employee_created",
    target_type: "profile",
    target_id: user.user.id,
    metadata: { email: form.email },
  });
  revalidatePath("/employees");
  return {
    success: "Employee account created. Share credentials securely.",
    tempPassword: password,
  };
}
