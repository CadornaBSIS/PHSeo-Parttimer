import { PageHeader } from "@/components/layout/page-header";
import { TimeInOutPanel } from "@/features/timeclock/components/time-in-out-panel";
import { ManagerTimeRecords } from "@/features/timeclock/components/manager-time-records";
import { requireProfile } from "@/lib/auth/session";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TimeClockPage() {
  const profile = await requireProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Record"
        description="Clock in, take breaks, and clock out for today."
        userId={profile.id}
      />
      {profile.role === "manager" ? (
        <div className="space-y-6">
          <TimeInOutPanel />
          <ManagerTimeRecords />
        </div>
      ) : (
        <TimeInOutPanel />
      )}
    </div>
  );
}
