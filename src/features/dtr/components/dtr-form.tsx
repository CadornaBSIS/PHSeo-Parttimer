"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, parseISO } from "date-fns";
import { Loader2, Plus, Save, Send, X } from "lucide-react";
import { dtrFormSchema, DtrFormValues } from "../schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveDtrAction } from "../actions";
import { calculateDurationMinutes, formatMinutes, ensureMonday, isWithinWeek } from "@/utils/date";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TimepickerInput } from "@/components/common/timepicker-input";

type Props = {
  projects: { id: string; name: string }[];
  initialData?: Partial<DtrFormValues> & { status?: "draft" | "submitted" };
  readOnly?: boolean;
  hideActions?: boolean;
  allowedWeeks?: { start: string; end: string }[];
};

const fallbackProjects = [
  "Tech24",
  "KoreanFiz",
  "Allinclusive",
  "Wixmediagroup",
  "Monarqincubator",
  "Tabletalegames",
  "WooriCasino",
  "Vegasbetgames",
  "Yyzhenshun",
  "Allegiantairticket",
  "무료슬롯.org",
  "PH SEO",
  "Ad hoc",
  
].map((name, idx) => ({ id: `fallback-${idx}`, name }));

function isPersistedProjectId(projectId: string | null | undefined) {
  return Boolean(projectId && !projectId.startsWith("fallback-"));
}

export function DtrForm({
  projects,
  initialData,
  readOnly: forceReadOnly,
  hideActions = false,
  allowedWeeks,
}: Props) {
  const router = useRouter();
  const projectOptions = projects.length ? projects : fallbackProjects;
  const nowStr = format(new Date(), "yyyy-MM-dd");
  const fallbackWeek =
    allowedWeeks?.find((w) => isWithinWeek(nowStr, w.start, w.end)) ??
    allowedWeeks?.[0];
  const baseDate = initialData?.work_date ?? fallbackWeek?.start ?? nowStr;
  const mondayFromBase = format(ensureMonday(parseISO(baseDate)), "yyyy-MM-dd");
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const readOnly = forceReadOnly || status === "submitted";
  const [submitting, setSubmitting] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState(baseDate);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

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
      week_start: initialData?.week_start ?? (fallbackWeek?.start ?? mondayFromBase),
      week_end:
        initialData?.week_end ??
        (fallbackWeek?.end ?? format(addDays(parseISO(mondayFromBase), 6), "yyyy-MM-dd")),
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

  const parseTasks = (notes?: string | null) =>
    String(notes ?? "")
      .trim()
      // Store tasks as blocks separated by blank lines.
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

  const [tasks, setTasks] = useState<string[]>(() => parseTasks(initialData?.notes));
  const [taskDraft, setTaskDraft] = useState("");

  useEffect(() => {
    if (readOnly) return;
    form.setValue("notes", tasks.join("\n\n"));
  }, [tasks, form, readOnly]);

  // Time picking is handled by `timepicker-ui` via `TimepickerInput`.

  useEffect(() => {
    if (!workDateWatch) return;
    const matchedWeek = allowedWeeks?.find((w) => isWithinWeek(workDateWatch, w.start, w.end));
    const weekStart =
      matchedWeek?.start ?? format(ensureMonday(parseISO(workDateWatch)), "yyyy-MM-dd");
    const weekEnd =
      matchedWeek?.end ?? format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
    form.setValue("week_start", weekStart);
    form.setValue("week_end", weekEnd);
  }, [workDateWatch, form, allowedWeeks]);

  useEffect(() => {
    const selectedNames = selectedProjects
      .map((id) => projectOptions.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[];
    form.setValue("project_account", selectedNames.join(", "));
    const primaryProjectId = selectedProjects.find((projectId) => isPersistedProjectId(projectId)) ?? null;
    form.setValue("project_id", primaryProjectId);
  }, [selectedProjects, form, projectOptions]);

  const duration = useMemo(
    () => calculateDurationMinutes(startTimeWatch ?? undefined, endTimeWatch ?? undefined),
    [startTimeWatch, endTimeWatch],
  );
  const closeProjectsDropdown = () => setProjectDropdownOpen(false);

  const handleSubmit = async (submit: boolean) => {
    setSubmitting(true);
    try {
      const valid = await form.trigger();
      if (!valid) {
        const firstError =
          Object.values(form.formState.errors)[0]?.message ??
          "Fix validation errors.";
        toast.error(firstError as string);
        return;
      }
      const values = form.getValues();
      const result = await saveDtrAction(values, submit);
      if (result.error) {
        // Surface server-side errors on the work date to make conflicts obvious
        if (result.field === "work_date" || result.error.toLowerCase().includes("duplicate dtr")) {
          form.setError("work_date", {
            type: "server",
            message: result.error,
          });
        } else {
          form.setError("root.serverError", {
            type: "server",
            message: result.error,
          });
        }
        toast.error(result.error);
        return;
      }
      toast.success(result.success ?? "Saved");
      setStatus(submit ? "submitted" : "draft");
      if (submit) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
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
                          const allowed =
                            !allowedWeeks ||
                            allowedWeeks.some((w) => isWithinWeek(tempDate, w.start, w.end));
                          if (!allowed) {
                            toast.error("Schedule required for that week.");
                            return;
                          }
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
                <TimepickerInput
                  id="start_time"
                  value={startTimeWatch ?? "09:00"}
                  disabled={readOnly}
                  onChange={(next) => form.setValue("start_time", next)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>End time</Label>
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm space-y-3">
                <TimepickerInput
                  id="end_time"
                  value={endTimeWatch ?? "18:00"}
                  disabled={readOnly}
                  onChange={(next) => form.setValue("end_time", next)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accomplished tasks</Label>
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm space-y-3">
              {tasks.length ? (
                <div className="space-y-2">
                  {tasks.map((task, index) => (
                    <div
                      key={`${task}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                        <span className="text-slate-500 mr-2">{index + 1}.</span>
                        {task}
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="mt-0.5 rounded-md p-1 text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                          aria-label="Remove task"
                          onClick={() => {
                            setTasks((prev) => prev.filter((_, idx) => idx !== index));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center">
                  <p className="text-sm font-medium text-slate-700">No tasks added yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Add tasks one by one using the field below.
                  </p>
                </div>
              )}

              {!readOnly ? (
                <div className="space-y-2">
                  <Textarea
                    value={taskDraft}
                    placeholder={`Created Blog Under Allinclusive\nDescription:\nTitle: Link\nTitle: Image Link`}
                    rows={4}
                    className="rounded-xl bg-white/90"
                    onChange={(e) => setTaskDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      // Keep Enter for newlines; Ctrl/Cmd+Enter adds the task.
                      if (!(e.ctrlKey || e.metaKey)) return;
                      e.preventDefault();
                      const next = taskDraft.trim();
                      if (!next) return;
                      setTasks((prev) => [...prev, next]);
                      setTaskDraft("");
                    }}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      const next = taskDraft.trim();
                      if (!next) return;
                      setTasks((prev) => [...prev, next]);
                      setTaskDraft("");
                    }}
                    disabled={!taskDraft.trim()}
                    className="h-12 w-full justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Add task
                  </Button>
                  <p className="text-xs text-slate-500">
                    Tip: Press <span className="font-medium">Ctrl + Enter</span> to add quickly.
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Suggested format
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Keep it short and include the project name. Add links on a separate line:
                </p>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-line">
                  {`Created Blog Under Allinclusive\nDescription:\nTitle: Link\nTitle: Image Link\n\nTranslated Blog Under Allinclusive\nDescription:\nTitle: Link\nTitle: Image Link\n\nAnd so on.`}
                </div>
              </div>
            </div>
          </div>

          {!hideActions ? (
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
          ) : null}
        </div>
      </div>

    </>
  );
}
