import { Profile, Role } from "@/types/db";

export function isManager(profile: Profile | null): boolean {
  return profile?.role === "manager";
}

export function isEmployee(profile: Profile | null): boolean {
  return profile?.role === "employee";
}

export function canEditDraft(status: string) {
  return status === "draft";
}

export function requireManager(profile: Profile | null) {
  if (!isManager(profile)) {
    throw new Error("Manager access only");
  }
}

export const roleLabel: Record<Role, string> = {
  manager: "Manager",
  employee: "Employee",
};
