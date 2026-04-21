import { PageHeader } from "@/components/layout/page-header";
import { TimeInOutPanel } from "@/features/timeclock/components/time-in-out-panel";
import { ManagerTimeRecords } from "@/features/timeclock/components/manager-time-records";
import { TimeRecordHistory } from "@/features/timeclock/components/time-record-history";
import { TeamTimeRecordHistory } from "@/features/timeclock/components/team-time-record-history";
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
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">Team time record history</p>
              <p className="text-sm text-slate-500">
                Weekly breakdown of employee and manager records for the last 90 days.
              </p>
            </div>
            <TeamTimeRecordHistory />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <TimeInOutPanel />
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">History</p>
              <p className="text-sm text-slate-500">
                Weekly breakdown of your time records.
              </p>
            </div>
            <TimeRecordHistory showHeader={false} />
          </div>
        </div>
      )}
    </div>
  );
}
