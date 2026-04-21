"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dispatchNotificationCountSync } from "@/features/notifications/client-events";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Notification } from "@/types/db";

type NotificationBellProps = {
  userId: string;
};

export function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supabase] = useState(() => createBrowserSupabaseClient());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const triggerId = `notification-menu-trigger-${userId}`;

  const loadNotifications = useCallback(async () => {
    const [{ data }, { count, error: countError }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, user_id, type, title, message, is_read, link, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false),
    ]);

    setNotifications((data as Notification[] | null) ?? []);

    if (!countError) {
      const nextUnreadCount = count ?? 0;
      setUnreadCount(nextUnreadCount);
      dispatchNotificationCountSync(userId, nextUnreadCount);
    }
  }, [supabase, userId]);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadNotifications();
        },
      )
      .subscribe();

    return () => {
      window.clearTimeout(initialLoadTimer);
      void supabase.removeChannel(channel);
    };
  }, [loadNotifications, supabase, userId]);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    await loadNotifications();
    router.refresh();
  };

  const markAllRead = async () => {
    if (!unreadCount) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) {
      throw new Error(error.message);
    }

    await loadNotifications();
    router.refresh();
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button
          id={triggerId}
          variant="ghost"
          size="icon"
          className="relative h-auto w-auto min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 hover:bg-transparent focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount ? (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content
        align="end"
        sideOffset={10}
        className={cn(
          "z-50 w-[calc(100vw-1.5rem)] max-w-[360px] rounded-2xl border border-border bg-white p-2 shadow-2xl",
        )}
      >
        <div className="flex items-center justify-between px-2 py-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <p className="text-[11px] text-slate-500">
              {unreadCount ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!unreadCount || pending}
            onClick={() => {
              startTransition(() => {
                void markAllRead();
              });
            }}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>

        <DropdownMenu.Separator className="my-1 h-px bg-border" />

        <div className="max-h-[420px] overflow-y-auto">
          {notifications.length ? (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50",
                  !item.is_read && "bg-accent/5",
                )}
                onClick={() => {
                  startTransition(() => {
                    void markRead(item.id);
                  });
                  setOpen(false);
                  if (item.link) router.push(item.link);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {!item.is_read ? (
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-slate-600">{item.message}</p>
                <p className="text-[11px] text-slate-400">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No notifications yet.
            </div>
          )}
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
