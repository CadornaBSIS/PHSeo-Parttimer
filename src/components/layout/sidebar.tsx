"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CalendarClock,
  CircleUserRound,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useTransition } from "react";
import { Role } from "@/types/db";
import { Profile } from "@/types/db";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/features/auth/actions";

type SidebarProps = {
  profile: Profile;
  role: Role;
  open?: boolean;
  onClose?: () => void;
};

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["manager", "employee"],
  },
  {
    label: "Schedule",
    href: "/schedule",
    icon: CalendarClock,
    roles: ["manager", "employee"],
  },
  {
    label: "DTR",
    href: "/dtr",
    icon: Clock3,
    roles: ["manager", "employee"],
  },
  {
    label: "Employees",
    href: "/employees",
    icon: Users,
    roles: ["manager"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
    roles: ["manager"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["manager", "employee"],
  },
];

export function AppSidebar({ profile, role, open, onClose }: SidebarProps) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const prefetchRoutes = useMemo(() => {
    const baseRoutes = ["/dashboard", "/schedule", "/dtr", "/settings", "/profile"];
    const managerRoutes = ["/employees", "/reports"];
    const listFilters = [
      "/schedule?status=draft",
      "/schedule?status=submitted",
      "/dtr?status=draft",
      "/dtr?status=submitted",
    ];

    if (role === "manager") {
      return [...baseRoutes, ...managerRoutes, ...listFilters];
    }

    return [...baseRoutes, "/schedule/new", "/dtr/new", ...listFilters];
  }, [role]);

  useEffect(() => {
    for (const route of prefetchRoutes) {
      router.prefetch(route);
    }
  }, [prefetchRoutes, router]);

  return (
    <aside
      className={cn(
        "bg-sidebar text-white w-64 border-r border-white/5 h-screen overflow-y-auto flex-col transition-transform duration-200",
        open
          ? "fixed inset-y-0 left-0 z-40 flex md:translate-x-0"
          : "hidden md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex",
      )}
    >
      <div className="px-5 py-6 flex items-center gap-3 border-b border-white/5">
        <Image
          src="/ph-seo-logo.png"
          alt="PH SEO logo"
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
          priority
        />
        <div>
          <p className="text-sm text-slate-200">PH SEO</p>
          <p className="text-lg font-semibold text-white leading-tight">
            Parttimer
          </p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => item.roles.includes(role))
          .map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={() => {
                  // Close the mobile drawer immediately after navigation tap.
                  onClose?.();
                }}
                className={cn(
                  "sidebar-link",
                  active && "sidebar-link-active text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="px-4 pb-3">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              id="sidebar-profile-menu-trigger"
              className="w-full inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 bg-white/5 hover:bg-white/10"
            >
              <CircleUserRound className="h-5 w-5 text-slate-200" />
              <div className="text-left">
                <p className="text-sm font-semibold text-white leading-tight">
                  {profile.full_name}
                </p>
                <p className="text-[11px] uppercase text-slate-300 tracking-wide">
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
            <DropdownMenu.Item asChild>
              <Link
                href="/profile"
                prefetch
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-800 hover:bg-slate-100"
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-800">
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
      <div className="px-4 pb-6 text-xs text-slate-400">
        Internal use only. Data is protected via Supabase RLS.
      </div>
    </aside>
  );
}
