"use client";

import {
  Bell,
  CircleUserRound,
  LogOut,
  Menu,
  ShieldCheck,
  User,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Profile } from "@/types/db";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

type HeaderProps = {
  profile: Profile;
  onMenuClick?: () => void;
};

export function AppHeader({ profile, onMenuClick }: HeaderProps) {
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-white/90 backdrop-blur border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs text-slate-500">PH SEO Parttimer</p>
          <p className="text-base font-semibold text-slate-900">
            Internal Operations
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 bg-white hover:bg-slate-50">
              <CircleUserRound className="h-5 w-5 text-slate-700" />
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-900 leading-tight">
                  {profile.full_name}
                </p>
                <p className="text-[11px] uppercase text-slate-500 tracking-wide">
                  {profile.role}
                </p>
              </div>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className={cn(
              "min-w-[200px] rounded-lg border border-border bg-white p-2 shadow-lg",
            )}
          >
            <DropdownMenu.Label className="px-2 py-1 text-xs text-slate-500">
              Signed in
            </DropdownMenu.Label>
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-800 hover:bg-slate-100">
              <User className="h-4 w-4" />
              Profile
            </DropdownMenu.Item>
            <DropdownMenu.Item className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-800 hover:bg-slate-100">
              <ShieldCheck className="h-4 w-4" />
              Role: {profile.role}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-2 h-px bg-border" />
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50"
              onSelect={(e) => {
                e.preventDefault();
                startTransition(() => {
                  void signOutAction();
                });
              }}
            >
              <LogOut className="h-4 w-4" />
              {pending ? "Signing out..." : "Sign out"}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
