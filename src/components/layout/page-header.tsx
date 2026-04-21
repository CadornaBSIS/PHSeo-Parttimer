import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  userId?: string;
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  userId,
  className,
}: Props) {
  const desktopBell = userId ? (
    <div className="hidden md:block">
      <NotificationBell userId={userId} />
    </div>
  ) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
        </div>
        {actions || userId ? (
          <div className="flex w-full items-center gap-2 sm:w-auto md:shrink-0">
            {desktopBell}
            {actions}
          </div>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}
