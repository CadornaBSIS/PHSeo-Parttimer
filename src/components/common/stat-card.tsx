import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  trend?: { label: string; direction: "up" | "down" };
  className?: string;
};

export function StatCard({
  label,
  value,
  icon,
  description,
  trend,
  className,
}: Props) {
  return (
    <Card className={cn("flex items-start justify-between", className)}>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        {description ? (
          <p className="text-sm text-slate-500">{description}</p>
        ) : null}
        {trend ? (
          <p
            className={cn(
              "text-xs font-medium",
              trend.direction === "up" ? "text-emerald-600" : "text-red-600",
            )}
          >
            {trend.label}
          </p>
        ) : null}
      </div>
      {icon ? <div className="text-slate-400">{icon}</div> : null}
    </Card>
  );
}
