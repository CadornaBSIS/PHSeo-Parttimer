"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, parseISO } from "date-fns";
import { Loader2, Save, Send } from "lucide-react";
import { scheduleFormSchema, ScheduleFormValues } from "../schema";
import { WeeklyRangePicker } from "@/components/common/weekly-range-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveScheduleAction, updateScheduleApprovalAction } from "../actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { ensureMonday } from "@/utils/date";
import { useRouter } from "next/navigation";
import { Role, ScheduleApprovalStatus, ScheduleStatus } from "@/types/db";

type Props = {
  initialData?: Partial<ScheduleFormValues> & {
    status?: "draft" | "submitted";
  };
  readOnly?: boolean;
  viewerRole?: Role;
  scheduleId?: string;
  reviewLocked?: boolean;
  approvalStatusOnSave?: ScheduleApprovalStatus;
  defaultApprovalStatus?: ScheduleApprovalStatus;
};

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type WeekDay = ScheduleFormValues["days"][number];

function buildWeekDays(
  weekStart: string,
  defaultApprovalStatus: ScheduleApprovalStatus,
): WeekDay[] {
  const start = parseISO(weekStart);
  return dayLabels.map((_, idx) => {
    const date = addDays(start, idx);
    return {
      day_of_week: idx + 1,
      work_date: format(date, "yyyy-MM-dd"),
      work_status: "working" as WeekDay["work_status"],
      approval_status: defaultApprovalStatus as WeekDay["approval_status"],
      start_time: "09:00",
      end_time: "18:00",
      notes: "",
    };
  });
}

export function ScheduleWeekForm({
  initialData,
  readOnly: forceReadOnly,
  viewerRole = "employee",
  scheduleId,
  reviewLocked = false,
  approvalStatusOnSave = "for_approval",
  defaultApprovalStatus = "for_approval",
}: Props) {
  const defaultWeekStart =
    initialData?.week_start ??
    format(ensureMonday(new Date()), "yyyy-MM-dd");
  const initialWeekStartRef = useRef(defaultWeekStart);
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const sortedInitialDays =
    initialData?.days
      ?.map((day) => ({
        ...day,
        approval_status: day.approval_status ?? defaultApprovalStatus,
      }))
      .sort((a, b) => a.day_of_week - b.day_of_week);

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      id: initialData?.id,
      week_start: defaultWeekStart,
      week_end:
        initialData?.week_end ??
        format(addDays(parseISO(defaultWeekStart), 6), "yyyy-MM-dd"),
      days: sortedInitialDays ?? buildWeekDays(defaultWeekStart, defaultApprovalStatus),
    },
  });

  const watchWeekStart = form.watch("week_start");

  useEffect(() => {
    if (!watchWeekStart) return;
    const isInitialWeek = watchWeekStart === initialWeekStartRef.current;

    // Keep DB days on first load when the week start hasn't changed.
    if (!initialized && initialData?.days && isInitialWeek) {
      setInitialized(true);
      return;
    }

    setInitialized(true);

    // Only rebuild when the week start actually changes or there were no initial days.
    if (initialData?.days && isInitialWeek) return;

    const weekEnd = format(addDays(parseISO(watchWeekStart), 6), "yyyy-MM-dd");
    form.setValue("week_end", weekEnd);
    const newDays = buildWeekDays(watchWeekStart, defaultApprovalStatus);
    form.setValue("days", newDays);
  }, [watchWeekStart, form, initialized, initialData?.days, defaultApprovalStatus]);

  // When the user switches to a different week, treat it as a fresh draft
  useEffect(() => {
    if (!initialized) return;
    const isInitialWeek = watchWeekStart === initialWeekStartRef.current;
    if (!isInitialWeek) {
      setStatus("draft");
      form.setValue("id", undefined);
    }
  }, [watchWeekStart, initialized, form]);

  const isManager = viewerRole === "manager";
  const reviewOnly = isManager && status === "submitted" && !reviewLocked;
  const readOnly = forceReadOnly || (status === "submitted" && !reviewOnly);
  const hasPendingApprovals = form
    .watch("days")
    .some((day) => day.approval_status === "for_approval");

  const handleRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      form.setValue("week_start", range.start);
      form.setValue("week_end", range.end);
    },
    [form],
  );

  const handleSubmit = async (submit: boolean, finalizeReview = true) => {
    setSubmitting(true);
    try {
      if (reviewOnly) {
        if (!scheduleId) {
          toast.error("Schedule review is missing its schedule ID.");
          return;
        }
        const result = await updateScheduleApprovalAction(
          scheduleId,
          form.getValues("days").map((day) => ({
            day_of_week: day.day_of_week,
            approval_status: day.approval_status,
          })),
          finalizeReview,
        );
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success(result.success ?? "Schedule review saved");
        router.replace("/schedule");
        return;
      }

      const valid = await form.trigger();
      if (!valid) {
        toast.error("Please fix validation errors.");
        return;
      }
       const values = form.getValues();
       const normalizedValues: ScheduleFormValues = {
         ...values,
         days: values.days.map((day) => ({
           ...day,
           approval_status: approvalStatusOnSave,
         })),
       };
       const result = await saveScheduleAction(normalizedValues, submit);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Saved");
      setStatus(submit ? "submitted" : "draft");
      if (submit) {
        router.push("/dashboard");
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const dayFields = form.watch("days");
  const showReviewResultOptions =
    viewerRole === "manager" || (viewerRole === "employee" && status === "submitted");

  const batchUpdateApproval = useCallback(
    (value: WeekDay["approval_status"]) => {
      const updated = form.getValues("days").map((day) => ({
        ...day,
        approval_status: value,
      }));
      form.setValue("days", updated);
    },
    [form],
  );

  // Live status/days updates when another user reviews this schedule
  useEffect(() => {
    if (!scheduleId) return;
    const supabase = createBrowserSupabaseClient();

    const reload = async () => {
      const { data } = await supabase
        .from("schedules")
        .select("status, schedule_days(*)")
        .eq("id", scheduleId)
        .maybeSingle();
      if (data?.status) setStatus(data.status as ScheduleStatus);
      if (data?.schedule_days) {
        const sortedDays =
          data.schedule_days
            .map((day) => ({ ...day, approval_status: day.approval_status ?? "for_approval" }))
            .sort((a, b) => a.day_of_week - b.day_of_week);
        form.setValue("days", sortedDays);
      }
    };

    const channel = supabase
      .channel(`schedule:${scheduleId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "schedules", filter: `id=eq.${scheduleId}` },
        () => {
          void reload();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [form, scheduleId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Week range
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {format(parseISO(form.watch("week_start")), "MMM d")} -{" "}
            {format(parseISO(form.watch("week_end")), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Status</Badge>
          <StatusBadge status={status as ScheduleStatus} />
        </div>
      </div>

      {!reviewOnly ? (
        <WeeklyRangePicker
          value={{
            start: form.watch("week_start"),
            end: form.watch("week_end"),
          }}
          onChange={handleRangeChange}
        />
      ) : null}

      {reviewOnly ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reviewLocked}
            onClick={() => batchUpdateApproval("approved")}
          >
            Approve all days
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reviewLocked}
            onClick={() => batchUpdateApproval("not_approved")}
          >
            Not approve all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={reviewLocked}
            onClick={() => batchUpdateApproval("for_approval")}
          >
            Reset to pending
          </Button>
        </div>
      ) : null}

      <div className="overflow-auto scroll-section">
        <table className="w-full min-w-[920px] text-sm border border-border rounded-lg">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="p-3 text-xs font-semibold text-slate-500">Day</th>
              <th className="p-3 text-xs font-semibold text-slate-500">Date</th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                Availability
              </th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                Start
              </th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                End
              </th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {dayFields.map((day, idx) => (
              <tr
                key={day.day_of_week}
                className="border-t border-border hover:bg-slate-50/60"
              >
                <td className="p-3 font-semibold text-slate-800">
                  {dayLabels[day.day_of_week - 1] ?? dayLabels[idx]}
                </td>
                <td className="p-3">
                  <Input
                    type="date"
                    value={day.work_date}
                    disabled
                    className="bg-slate-50"
                  />
                </td>
                <td className="p-3 min-w-[140px]">
                  <Select
                    value={day.work_status}
                    disabled={readOnly || reviewOnly}
                    suppressHydrationWarning
                    onChange={(e) => {
                      if (reviewOnly) return;
                      const next = [...form.getValues("days")];
                      next[idx].work_status = e.target.value as WeekDay["work_status"];
                      form.setValue("days", next);
                    }}
                  >
                    <option value="working">Working</option>
                    <option value="day_off">Day off</option>
                    <option value="leave">Leave</option>
                    <option value="holiday">Holiday</option>
                    <option value="requested">Requested</option>
                  </Select>
                </td>
                <td className="p-3 min-w-[120px]">
                  <Input
                    type="time"
                    value={day.start_time ?? ""}
                    disabled={readOnly || reviewOnly || day.work_status !== "working"}
                    onChange={(e) => {
                      if (reviewOnly) return;
                      const next = [...form.getValues("days")];
                      next[idx].start_time = e.target.value;
                      form.setValue("days", next);
                    }}
                  />
                </td>
                <td className="p-3 min-w-[120px]">
                  <Input
                    type="time"
                    value={day.end_time ?? ""}
                    disabled={readOnly || reviewOnly || day.work_status !== "working"}
                    onChange={(e) => {
                      if (reviewOnly) return;
                      const next = [...form.getValues("days")];
                      next[idx].end_time = e.target.value;
                      form.setValue("days", next);
                    }}
                  />
                </td>
                <td className="p-3 min-w-[140px]">
                  <Select
                    value={day.approval_status}
                    disabled={!reviewOnly}
                    suppressHydrationWarning
                    onChange={(e) => {
                      const next = [...form.getValues("days")];
                      next[idx].approval_status = e.target.value as WeekDay["approval_status"];
                      form.setValue("days", next);
                    }}
                  >
                    <option value="for_approval">For Approval</option>
                    {showReviewResultOptions ? <option value="approved">Approve</option> : null}
                    {showReviewResultOptions ? <option value="not_approved">Not Approve</option> : null}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        {!isManager && !reviewOnly ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submitting || readOnly}
            suppressHydrationWarning
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save draft
          </Button>
        ) : null}
        {reviewOnly ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false, false)}
              disabled={submitting || reviewLocked}
              suppressHydrationWarning
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save draft
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false, true)}
              disabled={submitting || reviewLocked || hasPendingApprovals}
              suppressHydrationWarning
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save review
            </Button>
          </>
        ) : null}
        {!isManager ? (
          <Button
            type="button"
            variant="default"
            onClick={() => handleSubmit(true)}
            disabled={submitting || readOnly}
            suppressHydrationWarning
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit week
          </Button>
        ) : null}
      </div>
      {!reviewOnly && readOnly ? (
        <p className="text-xs text-slate-500">
          Submitted schedules are locked. Contact a manager for corrections.
        </p>
      ) : null}
      {reviewOnly ? (
        <div className="space-y-1 text-xs text-slate-500">
          <p>
            Managers can review submitted schedules by setting each day to Approve or Not Approve.
          </p>
          <p>
            Use Save draft if the review is still undecided. Save review becomes available only when all days are reviewed.
          </p>
        </div>
      ) : null}
      {isManager && reviewLocked ? (
        <p className="text-xs text-slate-500">
          This schedule has already been reviewed. Review fields are now locked.
        </p>
      ) : null}
    </div>
  );
}
