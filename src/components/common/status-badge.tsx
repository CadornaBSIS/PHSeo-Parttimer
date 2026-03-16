import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DtrStatus, ScheduleStatus } from "@/types/db";

type Props = {
  status: ScheduleStatus | DtrStatus | "active" | "inactive" | "archived" | string;
};

export function StatusBadge({ status }: Props) {
  type Variant = NonNullable<BadgeProps["variant"]>;
  const map: Record<string, { label: string; variant: Variant }> = {
    draft: { label: "Draft", variant: "warning" },
    submitted: { label: "Submitted", variant: "success" },
    active: { label: "Active", variant: "success" },
    inactive: { label: "Inactive", variant: "outline" },
  };

  const config = map[status] ?? { label: status, variant: "outline" };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
