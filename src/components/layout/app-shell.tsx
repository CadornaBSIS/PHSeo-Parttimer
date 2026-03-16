"use client";

import { ReactNode, useState } from "react";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/header";
import { Profile } from "@/types/db";

type Props = {
  profile: Profile;
  children: ReactNode;
};

export function AppShell({ profile, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <AppSidebar role={profile.role} open={sidebarOpen} />
      <div className="flex-1 flex flex-col">
        <AppHeader
          profile={profile}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 px-6 pb-10 pt-6">{children}</main>
      </div>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
    </div>
  );
}
