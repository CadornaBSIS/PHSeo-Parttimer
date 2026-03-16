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
import { Textarea } from "@/components/ui/textarea";
import { saveScheduleAction } from "../actions";
import { toast } from "sonner";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { ensureMonday } from "@/utils/date";
import { useRouter } from "next/navigation";
import { ScheduleStatus } from "@/types/db";

type Props = {
  initialData?: Partial<ScheduleFormValues> & {
    status?: "draft" | "submitted";
  };
  readOnly?: boolean;
};

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type WeekDay = ScheduleFormValues["days"][number];

function buildWeekDays(weekStart: string): WeekDay[] {
  const start = parseISO(weekStart);
  return dayLabels.map((_, idx) => {
    const date = addDays(start, idx);
    return {
      day_of_week: idx + 1,
      work_date: format(date, "yyyy-MM-dd"),
      work_status: "working" as WeekDay["work_status"],
      start_time: "09:00",
      end_time: "18:00",
      notes: "",
    };
  });
}

export function ScheduleWeekForm({ initialData, readOnly: forceReadOnly }: Props) {
  const defaultWeekStart =
    initialData?.week_start ??
    format(ensureMonday(new Date()), "yyyy-MM-dd");
  const initialWeekStartRef = useRef(defaultWeekStart);
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      id: initialData?.id,
      week_start: defaultWeekStart,
      week_end:
        initialData?.week_end ??
        format(addDays(parseISO(defaultWeekStart), 6), "yyyy-MM-dd"),
      days: initialData?.days ?? buildWeekDays(defaultWeekStart),
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
    const newDays = buildWeekDays(watchWeekStart);
    form.setValue("days", newDays);
  }, [watchWeekStart, form, initialized, initialData?.days]);

  const readOnly = forceReadOnly || status === "submitted";

  const handleRangeChange = useCallback(
    (range: { start: string; end: string }) => {
      form.setValue("week_start", range.start);
      form.setValue("week_end", range.end);
    },
    [form],
  );

  const handleSubmit = async (submit: boolean) => {
    setSubmitting(true);
    try {
      const valid = await form.trigger();
      if (!valid) {
        toast.error("Please fix validation errors.");
        return;
      }
      const values = form.getValues();
      const result = await saveScheduleAction(values, submit);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Saved");
      setStatus(submit ? "submitted" : "draft");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const dayFields = form.watch("days");

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

      <WeeklyRangePicker
        value={{
          start: form.watch("week_start"),
          end: form.watch("week_end"),
        }}
        onChange={handleRangeChange}
      />

      <div className="overflow-auto scroll-section">
        <table className="w-full text-sm border border-border rounded-lg">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="p-3 text-xs font-semibold text-slate-500">Day</th>
              <th className="p-3 text-xs font-semibold text-slate-500">Date</th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                Status
              </th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                Start
              </th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                End
              </th>
              <th className="p-3 text-xs font-semibold text-slate-500">
                Notes
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
                  {dayLabels[idx]}
                </td>
                <td className="p-3">
                  <Input
                    type="date"
                    value={day.work_date}
                    disabled
                    className="bg-slate-50"
                  />
                </td>
                <td className="p-3">
                  <Select
                    value={day.work_status}
                    disabled={readOnly}
                    suppressHydrationWarning
                    onChange={(e) => {
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
                <td className="p-3">
                  <Input
                    type="time"
                    value={day.start_time ?? ""}
                    disabled={readOnly || day.work_status !== "working"}
                    onChange={(e) => {
                      const next = [...form.getValues("days")];
                      next[idx].start_time = e.target.value;
                      form.setValue("days", next);
                    }}
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="time"
                    value={day.end_time ?? ""}
                    disabled={readOnly || day.work_status !== "working"}
                    onChange={(e) => {
                      const next = [...form.getValues("days")];
                      next[idx].end_time = e.target.value;
                      form.setValue("days", next);
                    }}
                  />
                </td>
                <td className="p-3">
                  <Textarea
                    value={day.notes ?? ""}
                    disabled={readOnly}
                    onChange={(e) => {
                      const next = [...form.getValues("days")];
                      next[idx].notes = e.target.value;
                      form.setValue("days", next);
                    }}
                    className="min-h-[60px]"
                    placeholder="Notes"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
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
        <Button
          type="button"
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
      </div>
      {readOnly ? (
        <p className="text-xs text-slate-500">
          Submitted schedules are locked. Contact a manager for corrections.
        </p>
      ) : null}
    </div>
  );
}
