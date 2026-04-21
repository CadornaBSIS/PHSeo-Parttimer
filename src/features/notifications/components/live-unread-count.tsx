"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  NOTIFICATION_COUNT_SYNC_EVENT,
} from "@/features/notifications/client-events";

type LiveUnreadCountProps = {
  userId: string;
  initialCount: number;
};

export function LiveUnreadCount({
  userId,
  initialCount,
}: LiveUnreadCountProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const loadUnreadCount = async () => {
      const { count: nextCount, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (!error) {
        setCount(nextCount ?? 0);
      }
    };

    void loadUnreadCount();

    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId: string; unreadCount: number }>;
      if (customEvent.detail?.userId !== userId) return;
      setCount(customEvent.detail.unreadCount);
    };

    window.addEventListener(NOTIFICATION_COUNT_SYNC_EVENT, handleSync as EventListener);

    const channel = supabase
      .channel(`notification-count:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void loadUnreadCount();
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener(NOTIFICATION_COUNT_SYNC_EVENT, handleSync as EventListener);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return <>{count.toLocaleString()}</>;
}
