import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ScheduleWeekForm } from "@/features/schedule/components/schedule-week-form";
import { requireProfile } from "@/lib/auth/session";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ManagerNewSchedulePage() {
  const profile = await requireProfile();
  if (profile.role !== "manager") redirect("/schedule");

  return (
    <div className="space-y-6">
      <PageHeader
        title="New schedule"
        description="Your schedule is auto-approved."
        userId={profile.id}
      />
      <div className="card">
        <ScheduleWeekForm
          viewerRole="employee"
          approvalStatusOnSave="approved"
          defaultApprovalStatus="approved"
        />
      </div>
    </div>
  );
}

