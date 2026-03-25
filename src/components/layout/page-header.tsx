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
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        ) : null}
      </div>
      {actions || userId ? (
        <div className="flex items-center gap-2">
          {userId ? <NotificationBell userId={userId} /> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
