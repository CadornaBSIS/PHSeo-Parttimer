import { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireProfile } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
