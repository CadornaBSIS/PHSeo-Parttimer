"use client";

import {
  Menu,
} from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Profile } from "@/types/db";

type HeaderProps = {
  profile: Profile;
  onMenuClick?: () => void;
};

export function AppHeader({ profile, onMenuClick }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between bg-white/90 backdrop-blur border-b border-border px-4 py-3 md:hidden"
    >
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="ml-auto">
        <NotificationBell userId={profile.id} />
      </div>
    </header>
  );
}
