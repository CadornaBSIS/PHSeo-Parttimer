export const NOTIFICATION_COUNT_SYNC_EVENT = "notifications:count-sync";

export function dispatchNotificationCountSync(userId: string, unreadCount: number) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_COUNT_SYNC_EVENT, {
      detail: { userId, unreadCount },
    }),
  );
}
