"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/sidebar";
import { AppHeader } from "@/components/layout/header";
import { Profile } from "@/types/db";

type Props = {
  profile: Profile;
  children: ReactNode;
};

export function AppShell({ profile, children }: Props) {
  const pathname = usePathname() ?? "";
  const [sidebarState, setSidebarState] = useState({ open: false, openedOnPath: "" });
  const sidebarOpen = sidebarState.open && sidebarState.openedOnPath === pathname;

  const closeSidebar = () => {
    setSidebarState({ open: false, openedOnPath: pathname });
  };

  const toggleSidebar = () => {
    setSidebarState((prev) => ({
      open: !(prev.open && prev.openedOnPath === pathname),
      openedOnPath: pathname,
    }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <AppSidebar
        profile={profile}
        role={profile.role}
        open={sidebarOpen}
        onClose={closeSidebar}
      />
      <div className="min-h-screen flex flex-col md:pl-64 overflow-x-hidden">
        <AppHeader
          profile={profile}
          onMenuClick={toggleSidebar}
        />
        <main className="flex-1 overflow-x-hidden px-4 pb-8 pt-3 sm:px-6 sm:pb-10 sm:pt-4">
          {children}
        </main>
      </div>
      {sidebarOpen ? (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
        />
      ) : null}
    </div>
  );
}
