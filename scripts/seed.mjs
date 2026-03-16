import { createClient } from "@supabase/supabase-js";
import { addDays, startOfWeek, formatISO } from "date-fns";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createUser({ email, password, full_name, role, department, employee_code }) {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) {
    console.error("Create user error", email, error.message);
    return null;
  }
  await client.from("profiles").upsert({
    id: data.user.id,
    full_name,
    email,
    role,
    department,
    employee_code,
    status: "active",
  });
  return data.user;
}

async function main() {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStart = formatISO(monday, { representation: "date" });
  const weekEnd = formatISO(addDays(monday, 6), { representation: "date" });

  const users = [
    {
      email: "manager@viteseo.test",
      password: "Manager123!",
      full_name: "Maya Manager",
      role: "manager",
      department: "Operations",
      employee_code: "MGR-001",
    },
    {
      email: "alice@viteseo.test",
      password: "Employee123!",
      full_name: "Alice Santos",
      role: "employee",
      department: "SEO",
      employee_code: "EMP-101",
    },
    {
      email: "ben@viteseo.test",
      password: "Employee123!",
      full_name: "Ben Cruz",
      role: "employee",
      department: "Content",
      employee_code: "EMP-102",
    },
    {
      email: "cara@viteseo.test",
      password: "Employee123!",
      full_name: "Cara Diaz",
      role: "employee",
      department: "Design",
      employee_code: "EMP-103",
    },
  ];

  for (const user of users) {
    const { data: existing } = await client
      .from("profiles")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    if (!existing?.id) {
      await createUser(user);
    }
  }

  const { data: projects } = await client
    .from("projects")
    .insert([
      { name: "Atlas SEO Revamp", code: "SEO-AT", description: "Enterprise SEO" },
      { name: "Lumen Support", code: "SUP-LM", description: "Support coverage" },
    ])
    .select();

  const { data: alice } = await client
    .from("profiles")
    .select("id")
    .eq("email", "alice@viteseo.test")
    .single();

  if (alice?.id) {
    const { data: schedule } = await client
      .from("schedules")
      .insert({
        employee_id: alice.id,
        week_start: weekStart,
        week_end: weekEnd,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (schedule?.id) {
      const days = Array.from({ length: 7 }).map((_, idx) => {
        const date = formatISO(addDays(monday, idx), { representation: "date" });
        return {
          schedule_id: schedule.id,
          day_of_week: idx + 1,
          work_date: date,
          work_status: idx < 5 ? "working" : "day_off",
          start_time: idx < 5 ? "09:00" : null,
          end_time: idx < 5 ? "18:00" : null,
          notes: idx < 5 ? "Planned shift" : "Rest",
        };
      });
      await client.from("schedule_days").insert(days);
    }

    await client.from("dtr_entries").insert({
      employee_id: alice.id,
      week_start: weekStart,
      week_end: weekEnd,
      work_date: weekStart,
      start_time: "09:00",
      end_time: "17:30",
      project_account: "Atlas SEO Revamp",
      project_id: projects?.[0]?.id ?? null,
      notes: "On-page optimization",
      image_link: "https://placehold.co/200x100",
      duration_minutes: 510,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });

    await client.from("audit_logs").insert({
      actor_id: alice.id,
      action: "seed_schedule_created",
      target_type: "schedule",
      target_id: schedule?.id ?? null,
      metadata: { week_start: weekStart },
    });
  }

  if (alice?.id) {
    await client.from("notifications").insert({
      user_id: alice.id,
      type: "info",
      title: "Welcome",
      message: "Sample notification for demo purposes",
      is_read: false,
    });
  }

  console.log("Seed completed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
