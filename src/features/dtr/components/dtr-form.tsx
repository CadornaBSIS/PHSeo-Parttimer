"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, parseISO } from "date-fns";
import { Loader2, Save, Send } from "lucide-react";
import { dtrFormSchema, DtrFormValues } from "../schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveDtrAction } from "../actions";
import { calculateDurationMinutes, formatMinutes, ensureMonday } from "@/utils/date";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  projects: { id: string; name: string }[];
  initialData?: Partial<DtrFormValues> & { status?: "draft" | "submitted" };
  readOnly?: boolean;
};

const fallbackProjects = [
  "Tech24",
  "KoreanFiz",
  "ViteSeo",
  "Tech24&KoreanFiz",
  "Wixmediagroup",
  "Monarqincubator",
  "Tabletalegames",
  "Ad hoc",
  "무료슬롯.org",
  "WooriCasino",
  "Vegasbetgames",
].map((name, idx) => ({ id: `fallback-${idx}`, name }));

export function DtrForm({ projects, initialData, readOnly: forceReadOnly }: Props) {
  const projectOptions = projects.length ? projects : fallbackProjects;
  const baseDate = initialData?.work_date ?? format(new Date(), "yyyy-MM-dd");
  const monday = format(ensureMonday(parseISO(baseDate)), "yyyy-MM-dd");
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [submitting, setSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState(baseDate);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [draftTime, setDraftTime] = useState<string | null>(null);

  const initialProjectNames =
    initialData?.project_account?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const initialProjectIds = initialData?.project_id ? [initialData.project_id] : [];
  const [selectedProjects, setSelectedProjects] = useState<string[]>(
    initialProjectIds.length
      ? initialProjectIds
      : projectOptions.filter((p) => initialProjectNames.includes(p.name)).map((p) => p.id),
  );

  const form = useForm<DtrFormValues>({
    resolver: zodResolver(dtrFormSchema),
    defaultValues: {
      id: initialData?.id,
      week_start: initialData?.week_start ?? monday,
      week_end:
        initialData?.week_end ??
        format(addDays(parseISO(monday), 6), "yyyy-MM-dd"),
      work_date: baseDate,
      start_time: initialData?.start_time ?? "09:00",
      end_time: initialData?.end_time ?? "18:00",
      project_account: initialData?.project_account ?? "",
      project_id: initialData?.project_id ?? null,
      notes: initialData?.notes ?? "",
      image_link: initialData?.image_link ?? "",
    },
  });

  const startTimeWatch = form.watch("start_time");
  const endTimeWatch = form.watch("end_time");
  const workDateWatch = form.watch("work_date");

  type TimeParts = { hour: number; minute: number; am: boolean };
  const parseTime = useCallback((val?: string | null): TimeParts => {
    if (!val) return { hour: 9, minute: 0, am: true };
    const [hStr, mStr] = val.split(":");
    let h = Number(hStr);
    const m = Number(mStr);
    const am = h < 12;
    if (h === 0) h = 12;
    if (h > 12) h -= 12;
    return { hour: isNaN(h) ? 9 : h, minute: isNaN(m) ? 0 : m, am };
  }, []);

  const format24 = (parts: TimeParts) => {
    let h = parts.hour % 12;
    if (!parts.am) h += 12;
    const hh = `${h}`.padStart(2, "0");
    const mm = `${Math.max(0, Math.min(59, parts.minute))}`.padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const formatDisplay = (val?: string | null) => {
    const { hour, minute, am } = parseTime(val);
    return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")} ${am ? "am" : "pm"}`;
  };

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => `${i}`.padStart(2, "0")), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => `${i}`.padStart(2, "0")), []);

  const openPicker = (field: "start" | "end") => {
    setDraftTime(field === "start" ? form.watch("start_time") ?? "09:00" : form.watch("end_time") ?? "18:00");
    setStartPickerOpen(field === "start");
    setEndPickerOpen(field === "end");
  };
  const closePicker = () => {
    setStartPickerOpen(false);
    setEndPickerOpen(false);
    setDraftTime(null);
  };
  const commitPicker = (field: "start" | "end") => {
    if (draftTime) {
      if (field === "start") form.setValue("start_time", draftTime);
      else form.setValue("end_time", draftTime);
    }
    closePicker();
  };

  useEffect(() => {
    if (!workDateWatch) return;
    const weekStart = format(ensureMonday(parseISO(workDateWatch)), "yyyy-MM-dd");
    const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
    form.setValue("week_start", weekStart);
    form.setValue("week_end", weekEnd);
  }, [workDateWatch, form]);

  useEffect(() => {
    const selectedNames = selectedProjects
      .map((id) => projectOptions.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    form.setValue("project_account", selectedNames.join(", "));
    form.setValue("project_id", selectedProjects[0] ?? null);
  }, [selectedProjects, form, projectOptions]);

  const duration = useMemo(
    () => calculateDurationMinutes(startTimeWatch ?? undefined, endTimeWatch ?? undefined),
    [startTimeWatch, endTimeWatch],
  );

  const readOnly = forceReadOnly || status === "submitted";
  const closeProjectsDropdown = () => setProjectDropdownOpen(false);

  const handleSubmit = async (submit: boolean) => {
    setSubmitting(true);
    try {
      const valid = await form.trigger();
      if (!valid) {
        toast.error("Fix validation errors.");
        return;
      }
      const values = form.getValues();
      const result = await saveDtrAction(values, submit);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Saved");
      setStatus(submit ? "submitted" : "draft");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-8">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-lg shadow-slate-200/60">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Duration</p>
              <p className="text-2xl font-semibold text-slate-900">{formatMinutes(duration)}</p>
            </div>
            <Badge variant="secondary" className="px-3 py-1 text-xs rounded-full">
              Status: {status}
            </Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase text-slate-500">Week start (Monday)</p>
              <Input type="date" value={form.watch("week_start")} readOnly disabled className="bg-slate-50 rounded-xl" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase text-slate-500">Week end</p>
              <Input type="date" value={form.watch("week_end")} readOnly disabled className="bg-slate-50 rounded-xl" />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Work date</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Input
                    type="date"
                    value={workDateWatch}
                    readOnly
                    disabled
                    className="bg-slate-50 rounded-xl"
                  />
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDatePickerOpen(true)}
                    >
                      Change
                    </Button>
                  ) : null}
                </div>
                {datePickerOpen && !readOnly ? (
                  <div className="rounded-lg border border-border bg-white p-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        value={tempDate}
                        onChange={(e) => setTempDate(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTempDate(workDateWatch);
                          setDatePickerOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!tempDate) return;
                          form.setValue("work_date", tempDate);
                          setDatePickerOpen(false);
                        }}
                      >
                        OK
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Project / Account</Label>
              <div className="relative space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between rounded-2xl border-slate-200 bg-white/90 shadow-sm"
                  disabled={readOnly}
                  onClick={() => setProjectDropdownOpen((v) => !v)}
                >
                  {selectedProjects.length
                    ? `${selectedProjects.length} selected`
                    : "Select up to 4 projects"}
                </Button>
                {projectDropdownOpen && !readOnly ? (
                  <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/98 shadow-xl backdrop-blur-lg">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm">
                      <span className="text-slate-600">{selectedProjects.length}/4 selected</span>
                      <Button type="button" size="sm" variant="ghost" onClick={closeProjectsDropdown}>
                        Close
                      </Button>
                    </div>
                    <div className="max-h-64 overflow-auto p-2">
                      {projectOptions.map((p) => {
                        const active = selectedProjects.includes(p.id);
                        const disabled = !active && selectedProjects.length >= 4;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={disabled}
                            className={cn(
                              "mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                              active ? "bg-accent text-white shadow-sm" : "hover:bg-slate-50",
                              disabled ? "opacity-50 cursor-not-allowed" : "",
                            )}
                            onClick={() => {
                              setSelectedProjects((prev) =>
                                prev.includes(p.id)
                                  ? prev.filter((id) => id !== p.id)
                                  : prev.length < 4
                                    ? [...prev, p.id]
                                    : prev,
                              );
                            }}
                          >
                            <span>{p.name}</span>
                            {active ? <Badge variant="secondary">Selected</Badge> : null}
                          </button>
                        );
                      })}
                      {!projectOptions.length ? (
                        <p className="px-2 py-1 text-xs text-slate-500">No projects available.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {(form.watch("project_account") || "")
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => (
                      <Badge key={name} variant="secondary" className="flex items-center gap-2">
                        {name}
                        {!readOnly ? (
                          <button
                            type="button"
                            className="text-[10px] font-semibold text-slate-600 hover:text-slate-800"
                            onClick={() => {
                              setSelectedProjects((prev) =>
                                prev.filter(
                                  (id) => projectOptions.find((p) => p.id === id)?.name !== name,
                                ),
                              );
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                      </Badge>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start time</Label>
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  disabled={readOnly}
                  onClick={() => openPicker("start")}
                >
                  {formatDisplay(form.watch("start_time"))}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>End time</Label>
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  disabled={readOnly}
                  onClick={() => openPicker("end")}
                >
                  {formatDisplay(form.watch("end_time"))}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="What did you work on?"
              disabled={readOnly}
              className="rounded-2xl bg-white/90"
              {...form.register("notes")}
            />
          </div>

          <div className="space-y-2">
            <Label>Image link (e.g., screenshot)</Label>
            <Input
              placeholder="https://..."
              disabled={readOnly}
              className="rounded-2xl"
              {...form.register("image_link")}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={submitting || readOnly}
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
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit
            </Button>
          </div>
        </div>
      </div>

      {(startPickerOpen || endPickerOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold">
              <button onClick={closePicker} className="text-amber-300 hover:text-amber-200">
                Cancel
              </button>
              <span className="uppercase tracking-[0.2em] text-slate-300 text-xs">
                {startPickerOpen ? "Start time" : "End time"}
              </span>
              <button
                onClick={() => commitPicker(startPickerOpen ? "start" : "end")}
                className="text-emerald-300 hover:text-emerald-200"
              >
                Save
              </button>
            </div>
            <div className="border-t border-slate-800 px-4 py-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="col-span-1">
                  <p className="mb-2 text-[11px] uppercase text-slate-400">Hour</p>
                  <div className="h-48 overflow-y-auto rounded-lg bg-slate-800/80 shadow-inner">
                    {hours.map((h) => (
                      <button
                        key={h}
                        className={cn(
                          "block w-full px-2 py-2 text-sm transition",
                          draftTime?.startsWith(h)
                            ? "bg-emerald-500 text-slate-900 font-semibold"
                            : "text-slate-100 hover:bg-slate-700/80",
                        )}
                        onClick={() => {
                          const parts = parseTime(draftTime);
                          setDraftTime(format24({ ...parts, hour: Number(h), am: parts.am }));
                        }}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-1">
                  <p className="mb-2 text-[11px] uppercase text-slate-400">Minute</p>
                  <div className="h-48 overflow-y-auto rounded-lg bg-slate-800/80 shadow-inner">
                    {minutes.map((m) => (
                      <button
                        key={m}
                        className={cn(
                          "block w-full px-2 py-2 text-sm transition",
                          draftTime?.split(":")[1] === m
                            ? "bg-emerald-500 text-slate-900 font-semibold"
                            : "text-slate-100 hover:bg-slate-700/80",
                        )}
                        onClick={() => {
                          const parts = parseTime(draftTime);
                          setDraftTime(format24({ ...parts, minute: Number(m) }));
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-1">
                  <p className="mb-2 text-[11px] uppercase text-slate-400">AM / PM</p>
                  <div className="grid gap-2">
                    {(["am", "pm"] as const).map((meridian) => (
                      <Button
                        key={meridian}
                        type="button"
                        variant={parseTime(draftTime).am === (meridian === "am") ? "default" : "outline"}
                        className="w-full"
                        onClick={() => {
                          const parts = parseTime(draftTime);
                          setDraftTime(format24({ ...parts, am: meridian === "am" }));
                        }}
                      >
                        {meridian.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
