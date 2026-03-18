"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  Clock3,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { Role } from "@/types/db";
import { cn } from "@/lib/utils";

type SidebarProps = {
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

export function AppSidebar({ role, open }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-sidebar text-white w-64 shrink-0 border-r border-white/5 min-h-screen flex-col transition-transform duration-200",
        open ? "fixed inset-y-0 left-0 z-40 flex md:translate-x-0" : "hidden md:flex",
      )}
    >
      <div className="px-5 py-6 flex items-center gap-3 border-b border-white/5">
        <Image
          src="/ViteSeo%20Logo.png"
          alt="PH SEO Parttimer logo"
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
      <div className="px-4 pb-6 text-xs text-slate-400">
        Internal use only. Data is protected via Supabase RLS.
      </div>
    </aside>
  );
}
