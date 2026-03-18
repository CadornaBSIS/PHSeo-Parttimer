export type Role = "manager" | "employee";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department: string | null;
  employee_code: string | null;
  status: "active" | "inactive" | "archived" | string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ScheduleStatus = "draft" | "submitted";
export type ScheduleApprovalStatus = "for_approval" | "approved" | "not_approved";

export interface Schedule {
  id: string;
  employee_id: string;
  week_start: string;
  week_end: string;
  status: ScheduleStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  employee?: Profile;
  days?: ScheduleDay[];
}

export interface ScheduleDay {
  id: string;
  schedule_id: string;
  day_of_week: number;
  work_date: string;
  work_status: "working" | "day_off" | "leave" | "holiday" | "requested";
  approval_status: ScheduleApprovalStatus;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
}

export type DtrStatus = "draft" | "submitted";

export interface DtrEntry {
  id: string;
  employee_id: string;
  week_start: string;
  week_end: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  project_id: string | null;
  project_account: string | null;
  notes: string | null;
  image_link: string | null;
  duration_minutes: number;
  status: DtrStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  employee?: Profile;
  project?: Project;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: Profile | null;
}
