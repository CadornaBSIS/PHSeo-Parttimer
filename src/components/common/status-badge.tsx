import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DtrStatus, ScheduleApprovalStatus, ScheduleStatus } from "@/types/db";

type Props = {
  status:
    | ScheduleStatus
    | ScheduleApprovalStatus
    | DtrStatus
    | "active"
    | "inactive"
    | "archived"
    | string;
};

export function StatusBadge({ status }: Props) {
  type Variant = NonNullable<BadgeProps["variant"]>;
  const map: Record<string, { label: string; variant: Variant }> = {
    draft: { label: "Draft", variant: "warning" },
    submitted: { label: "Submitted", variant: "success" },
    for_approval: { label: "For Approval", variant: "warning" },
    partially_reviewed: { label: "Partially Reviewed", variant: "review" },
    reviewed: { label: "Reviewed", variant: "danger" },
    approved: { label: "Approved", variant: "success" },
    not_approved: { label: "Not Approved", variant: "caution" },
    active: { label: "Active", variant: "success" },
    inactive: { label: "Inactive", variant: "outline" },
  };

  const config = map[status] ?? { label: status, variant: "outline" };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
