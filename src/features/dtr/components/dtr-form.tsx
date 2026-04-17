"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, parseISO } from "date-fns";
import { Loader2, Pencil, Plus, Save, Send, Trash2, X } from "lucide-react";
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
import { parseTaskBlock, splitTaskBlocks } from "../task-blocks";

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

  // Link fields can include a human title + a URL, e.g. "My Title: https://example.com/page".
  // We validate the first https:// URL we can find inside the field.
  const extractHttpsUrl = (value: string) => {
    const match = value.match(/https:\/\/\S+/i);
    if (!match) return null;

    // Strip common trailing punctuation users might type after pasting a URL.
    return match[0].replace(/[),.;]+$/, "");
  };

  const isValidHttpsUrlWithDomain = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      if (url.protocol !== "https:") return false;
      // Require a real-looking domain (contains a dot + tld).
      const host = url.hostname;
      if (!host.includes(".")) return false;
      const tld = host.split(".").pop();
      if (!tld || tld.length < 2) return false;
      return true;
    } catch {
      return false;
    }
  };

  const isValidLinkField = (value: string) => {
    const httpsUrl = extractHttpsUrl(value.trim());
    if (!httpsUrl) return false;
    return isValidHttpsUrlWithDomain(httpsUrl);
  };

  const [tasks, setTasks] = useState<string[]>(() => splitTaskBlocks(initialData?.notes));
  const [taskEditorOpen, setTaskEditorOpen] = useState(false);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [taskAttemptedSubmit, setTaskAttemptedSubmit] = useState(false);
  const [taskSection, setTaskSection] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskTitleLinks, setTaskTitleLinks] = useState<string[]>([""]);
  const [taskImageLinks, setTaskImageLinks] = useState<string[]>([""]);
  const taskSectionRef = useRef<HTMLInputElement | null>(null);
  const titleLinkRefs = useRef<Array<HTMLInputElement | null>>([]);
  const imageLinkRefs = useRef<Array<HTMLInputElement | null>>([]);

  const resetTaskEditor = () => {
    setTaskAttemptedSubmit(false);
    setTaskSection("");
    setTaskDescription("");
    setTaskTitleLinks([""]);
    setTaskImageLinks([""]);
    setEditingTaskIndex(null);
  };

  const openTaskEditorForEdit = (index: number) => {
    const parsed = parseTaskBlock(tasks[index] ?? "");
    setEditingTaskIndex(index);
    setTaskSection(parsed.section);
    setTaskDescription(parsed.description);
    setTaskTitleLinks(parsed.titleLinks);
    setTaskImageLinks(parsed.imageLinks);
    setTaskEditorOpen(true);
  };

  useEffect(() => {
    if (readOnly) return;
    form.setValue("notes", tasks.join("\n\n"));
  }, [tasks, form, readOnly]);

  // Time picking is handled by `timepicker-ui` via `TimepickerInput`.
  useEffect(() => {
    if (!taskEditorOpen) return;
    setTaskAttemptedSubmit(false);
    setTimeout(() => taskSectionRef.current?.focus(), 0);
  }, [taskEditorOpen]);

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
  const hasProjects = selectedProjects.length > 0;
  const hasTasks = tasks.length > 0;
  const closeProjectsDropdown = () => setProjectDropdownOpen(false);

  const taskEditorDisabledReason = useMemo(() => {
    if (!taskEditorOpen) return null;

    if (!taskSection.trim()) return "Section is required.";
    if (!taskDescription.trim()) return "Description is required.";

    const titleLinks = taskTitleLinks.map((item) => item.trim());
    const imageLinks = taskImageLinks.map((item) => item.trim());

    if (titleLinks.some((l) => !l)) return "All title links are required.";
    if (imageLinks.some((l) => !l)) return "All image links are required.";
    if (titleLinks.some((l) => !isValidLinkField(l))) {
      return "One or more title links are invalid. Include an https link with a domain (e.g. Title: https://example.com/page).";
    }
    if (imageLinks.some((l) => !isValidLinkField(l))) {
      return "One or more image links are invalid. Include an https link with a domain (e.g. Proof: https://drive.google.com/... ).";
    }

    return null;
  }, [taskEditorOpen, taskSection, taskDescription, taskTitleLinks, taskImageLinks]);

  const handleSubmit = async (submit: boolean) => {
    if (submit && (!hasTasks || taskEditorOpen)) {
      toast.error("Add at least one accomplished task before submitting.");
      return;
    }
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
        } else if (result.field) {
          form.setError(result.field as keyof DtrFormValues, {
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
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderTaskEditor = () => (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3">
          <div className="grid grid-cols-[130px_1fr] items-start gap-3">
            <div className="pt-3 text-sm font-medium text-slate-700">Section:</div>
            <div className="space-y-1">
              <Input
                ref={taskSectionRef}
                value={taskSection}
                placeholder="Created Blog Under Allinclusive"
                className={`h-12 rounded-xl ${
                  taskAttemptedSubmit && !taskSection.trim()
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
                onChange={(e) => setTaskSection(e.target.value)}
              />
              <p className="text-[11px] text-slate-500">
                Format: action + project (example: "Translated Blog Under Allinclusive")
              </p>
              {taskAttemptedSubmit && !taskSection.trim() ? (
                <p className="text-xs text-red-600">Section is required.</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] items-start gap-3">
            <div className="pt-3 text-sm font-medium text-slate-700">Description:</div>
            <div className="space-y-1">
              <Textarea
                value={taskDescription}
                placeholder="Write a short description..."
                rows={3}
                className={`rounded-xl bg-white/90 ${
                  taskAttemptedSubmit && !taskDescription.trim()
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }`}
                onChange={(e) => setTaskDescription(e.target.value)}
              />
              <p className="text-[11px] text-slate-500">
                Keep it short and specific (what you did, for which page/post, and status).
              </p>
              {taskAttemptedSubmit && !taskDescription.trim() ? (
                <p className="text-xs text-red-600">Description is required.</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] items-start gap-3">
            <div className="pt-3 text-sm font-medium text-slate-700">Title: Link</div>
            <div className="space-y-2">
              {taskTitleLinks.map((value, index) => (
                <div key={`title-link-${index}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={(el) => {
                        titleLinkRefs.current[index] = el;
                      }}
                      value={value}
                      placeholder="Title: https://..."
                      className={cn(
                        "h-12 rounded-xl flex-1",
                        (taskAttemptedSubmit && !value.trim()) ||
                          (value.trim() && !isValidLinkField(value.trim()))
                          ? "border-red-500 focus-visible:ring-red-500"
                          : "",
                      )}
                      onChange={(e) => {
                        const next = [...taskTitleLinks];
                        next[index] = e.target.value;
                        setTaskTitleLinks(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || !e.shiftKey) return;
                        e.preventDefault();
                        const nextIndex = taskTitleLinks.length;
                        setTaskTitleLinks((prev) => [...prev, ""]);
                        setTimeout(() => {
                          titleLinkRefs.current[nextIndex]?.focus();
                        }, 0);
                      }}
                    />
                    {taskTitleLinks.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-xl"
                        aria-label="Remove title link field"
                        onClick={() => {
                          setTaskTitleLinks((prev) => {
                            const next = prev.filter((_, idx) => idx !== index);
                            return next.length ? next : [""];
                          });
                          setTimeout(() => {
                            const nextIndex = Math.max(0, index - 1);
                            titleLinkRefs.current[nextIndex]?.focus();
                          }, 0);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  {taskAttemptedSubmit && !value.trim() ? (
                    <p className="text-xs text-red-600">Link is required.</p>
                  ) : null}
                  {(taskAttemptedSubmit || Boolean(value.trim())) &&
                  value.trim() &&
                  !isValidLinkField(value.trim()) ? (
                    <p className="text-xs text-red-600">
                      Include an https link with a domain (example: `Title: https://example.com/page`).
                    </p>
                  ) : null}
                </div>
              ))}
              <p className="text-[11px] text-slate-500">
                Paste the page/post link(s). Press <span className="font-medium">Shift + Enter</span>{" "}
                to add another field.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[130px_1fr] items-start gap-3">
            <div className="pt-3 text-sm font-medium text-slate-700">Title: Image Link</div>
            <div className="space-y-2">
              {taskImageLinks.map((value, index) => (
                <div key={`image-link-${index}`} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      ref={(el) => {
                        imageLinkRefs.current[index] = el;
                      }}
                      value={value}
                      placeholder="Proof: https://..."
                      className={cn(
                        "h-12 rounded-xl flex-1",
                        (taskAttemptedSubmit && !value.trim()) ||
                          (value.trim() && !isValidLinkField(value.trim()))
                          ? "border-red-500 focus-visible:ring-red-500"
                          : "",
                      )}
                      onChange={(e) => {
                        const next = [...taskImageLinks];
                        next[index] = e.target.value;
                        setTaskImageLinks(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || !e.shiftKey) return;
                        e.preventDefault();
                        const nextIndex = taskImageLinks.length;
                        setTaskImageLinks((prev) => [...prev, ""]);
                        setTimeout(() => {
                          imageLinkRefs.current[nextIndex]?.focus();
                        }, 0);
                      }}
                    />
                    {taskImageLinks.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-12 w-12 rounded-xl"
                        aria-label="Remove image link field"
                        onClick={() => {
                          setTaskImageLinks((prev) => {
                            const next = prev.filter((_, idx) => idx !== index);
                            return next.length ? next : [""];
                          });
                          setTimeout(() => {
                            const nextIndex = Math.max(0, index - 1);
                            imageLinkRefs.current[nextIndex]?.focus();
                          }, 0);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  {taskAttemptedSubmit && !value.trim() ? (
                    <p className="text-xs text-red-600">Image link is required.</p>
                  ) : null}
                  {(taskAttemptedSubmit || Boolean(value.trim())) &&
                  value.trim() &&
                  !isValidLinkField(value.trim()) ? (
                    <p className="text-xs text-red-600">
                      Include an https link with a domain (example: `Proof: https://drive.google.com/...`).
                    </p>
                  ) : null}
                </div>
              ))}
              <p className="text-[11px] text-slate-500">
                Paste image proof link(s) (Drive, Dropbox, etc). Press{" "}
                <span className="font-medium">Shift + Enter</span> to add another field.
              </p>
            </div>
          </div>
        </div>
      </div>

	      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
	        <Button
	          type="button"
	          variant="outline"
	          className="h-12 w-full rounded-xl sm:w-[140px]"
	          onClick={() => {
	            setTaskEditorOpen(false);
	            resetTaskEditor();
	          }}
	        >
	          Cancel
	        </Button>
	        <Button
	          type="button"
	          onClick={() => {
		            setTaskAttemptedSubmit(true);
	            const section = taskSection.trim();
	            const description = taskDescription.trim();
	            const titleLinks = taskTitleLinks.map((item) => item.trim());
	            const imageLinks = taskImageLinks.map((item) => item.trim());

            if (!section) return toast.error("Section is required.");
            if (!description) return toast.error("Description is required.");
            if (titleLinks.some((link) => !link)) return toast.error("All title links are required.");
            if (imageLinks.some((link) => !link)) return toast.error("All image links are required.");
            if (titleLinks.some((link) => !isValidLinkField(link))) {
              return toast.error("One or more title links are invalid. Include an https link with a domain.");
            }
            if (imageLinks.some((link) => !isValidLinkField(link))) {
              return toast.error("One or more image links are invalid. Include an https link with a domain.");
            }

            const lines = [
              `Section: ${section}`,
              "Description:",
              description,
              "Title: Link",
              ...titleLinks,
              "Title: Image Link",
              ...imageLinks,
            ];

            const block = lines.join("\n");
            setTasks((prev) => {
              if (editingTaskIndex === null) return [...prev, block];
              return prev.map((item, idx) => (idx === editingTaskIndex ? block : item));
            });
	            resetTaskEditor();
	            setTaskEditorOpen(false);
	          }}
	          disabled={Boolean(taskEditorDisabledReason)}
	          className="h-12 w-full justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 sm:flex-1"
	        >
          {editingTaskIndex === null ? (
            <>
              <Plus className="h-4 w-4" />
              Add task
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save changes
            </>
	          )}
	        </Button>
	      </div>

      {taskEditorDisabledReason ? (
        <p className="mt-2 text-xs text-red-600">{taskEditorDisabledReason}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          All fields are required. Press <span className="font-medium">Shift + Enter</span> to add another link field.
        </p>
      )}
    </>
  );

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
	                  className={cn(
	                    "w-full justify-between rounded-2xl border-slate-200 bg-white/90 shadow-sm",
	                    form.formState.errors.project_account
	                      ? "border-red-500 focus-visible:ring-red-500"
	                      : "",
	                  )}
	                  disabled={readOnly}
	                  onClick={() => setProjectDropdownOpen((v) => !v)}
	                >
	                  <div className="flex w-full items-center justify-between gap-3">
	                    <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
	                      {selectedProjects.length ? (
	                        selectedProjects
	                          .map((id) => projectOptions.find((p) => p.id === id))
	                          .filter(Boolean)
	                          .map((p) => (
	                            <Badge
	                              key={p!.id}
	                              variant="secondary"
	                              className="flex items-center gap-1 rounded-full bg-slate-100 text-slate-800"
	                            >
	                              <span className="max-w-[140px] truncate">{p!.name}</span>
	                              {!readOnly ? (
	                                <span
	                                  role="button"
	                                  tabIndex={0}
	                                  className="ml-1 inline-flex rounded-full p-0.5 text-slate-600 hover:text-slate-900"
	                                  aria-label={`Remove ${p!.name}`}
	                                  onClick={(e) => {
	                                    e.preventDefault();
	                                    e.stopPropagation();
	                                    setSelectedProjects((prev) =>
	                                      prev.filter((pid) => pid !== p!.id),
	                                    );
	                                  }}
	                                  onKeyDown={(e) => {
	                                    if (e.key !== "Enter" && e.key !== " ") return;
	                                    e.preventDefault();
	                                    e.stopPropagation();
	                                    setSelectedProjects((prev) =>
	                                      prev.filter((pid) => pid !== p!.id),
	                                    );
	                                  }}
	                                >
	                                  <X className="h-3.5 w-3.5" />
	                                </span>
	                              ) : null}
	                            </Badge>
	                          ))
	                      ) : (
	                        <span className="truncate text-slate-500">Select up to 4 projects</span>
	                      )}
	                    </div>
	                    <span className="shrink-0 text-xs font-semibold text-slate-500">
	                      {selectedProjects.length}/4
	                    </span>
	                  </div>
	                </Button>
                {form.formState.errors.project_account ? (
                  <p className="text-xs text-red-600">
                    {String(form.formState.errors.project_account.message ?? "Project is required")}
                  </p>
                ) : null}
                {projectDropdownOpen && !readOnly ? (
                  <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white/98 shadow-xl backdrop-blur-lg">
	                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm">
	                      <span className="text-slate-600">{selectedProjects.length}/4</span>
		                      <Button
		                        type="button"
		                        size="icon"
		                        variant="ghost"
		                        className="h-8 w-8 rounded-full"
		                        onClick={closeProjectsDropdown}
		                        aria-label="Close project picker"
		                      >
		                        <X className="h-4 w-4" />
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
	                              setSelectedProjects((prev) => {
	                                const next = prev.includes(p.id)
	                                  ? prev.filter((id) => id !== p.id)
	                                  : prev.length < 4
	                                    ? [...prev, p.id]
	                                    : prev;

	                                // Auto-close once the 4th project is chosen.
	                                if (next.length === 4 && prev.length !== 4) {
	                                  setProjectDropdownOpen(false);
	                                }
	                                return next;
	                              });
	                            }}
	                          >
	                            <span>{p.name}</span>
	                            {/* Active state is already highlighted via background; no extra "Selected" tag. */}
	                          </button>
                        );
                      })}
                      {!projectOptions.length ? (
                        <p className="px-2 py-1 text-xs text-slate-500">No projects available.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
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
		                  {tasks.map((task, index) => {
		                    const parsed = parseTaskBlock(task, { ensureNonEmptyArrays: false });
		                    const isExpanded = !readOnly && taskEditorOpen && editingTaskIndex === index;
                        const titleLinks = parsed.titleLinks.filter(Boolean);
                        const imageLinks = parsed.imageLinks.filter(Boolean);

	                    return (
	                      <div
	                        key={`${task}-${index}`}
	                        className="rounded-xl border border-slate-200 bg-slate-50"
	                      >
	                        {!isExpanded ? (
	                          <div className="flex items-start justify-between gap-3 px-4 py-3">
	                            <div className="min-w-0 flex-1">
	                              <div className="flex max-w-full items-center gap-2 rounded-lg border-2 border-emerald-500 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
	                                <span className="text-emerald-600">{index + 1}.</span>
	                                <span className="truncate">{parsed.section || "Untitled task"}</span>
	                              </div>
	                            </div>
	                            {!readOnly ? (
	                              <div className="mt-0.5 flex items-center gap-1">
	                                <button
	                                  type="button"
	                                  className="rounded-md p-1 text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
	                                  aria-label="Edit task"
	                                  onClick={() => openTaskEditorForEdit(index)}
	                                >
	                                  <Pencil className="h-4 w-4" />
	                                </button>
		                                <button
		                                  type="button"
		                                  className="rounded-md p-1 text-slate-500 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
		                                  aria-label="Delete task"
		                                  onClick={() => {
		                                    setTasks((prev) => prev.filter((_, idx) => idx !== index));
		                                    if (editingTaskIndex === index) {
		                                      resetTaskEditor();
		                                      setTaskEditorOpen(false);
	                                    } else if (editingTaskIndex !== null && editingTaskIndex > index) {
	                                      setEditingTaskIndex((prev) =>
	                                        prev === null ? null : Math.max(0, prev - 1),
	                                      );
	                                    }
		                                  }}
		                                >
		                                  <Trash2 className="h-4 w-4" />
		                                </button>
	                              </div>
	                            ) : null}
	                          </div>
	                        ) : null}

                          {readOnly ? (
                            <div className="space-y-4 border-t border-slate-200 bg-white/70 px-4 py-4">
                              <div className="grid gap-1">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Description
                                </p>
                                <p className="whitespace-pre-wrap text-sm text-slate-800">
                                  {parsed.description?.trim() ? parsed.description : "-"}
                                </p>
                              </div>

                              <div className="grid gap-1">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Title links
                                </p>
                                {titleLinks.length ? (
                                  <ul className="space-y-1 text-sm text-slate-800">
                                    {titleLinks.map((line, linkIndex) => {
                                      const url = extractHttpsUrl(line);
                                      return (
                                        <li key={`title-link-${index}-${linkIndex}`} className="break-words">
                                          {url ? (
                                            <a
                                              href={url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                                            >
                                              {line}
                                            </a>
                                          ) : (
                                            line
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-700">-</p>
                                )}
                              </div>

                              <div className="grid gap-1">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  Image links
                                </p>
                                {imageLinks.length ? (
                                  <ul className="space-y-1 text-sm text-slate-800">
                                    {imageLinks.map((line, linkIndex) => {
                                      const url = extractHttpsUrl(line);
                                      return (
                                        <li key={`image-link-${index}-${linkIndex}`} className="break-words">
                                          {url ? (
                                            <a
                                              href={url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
                                            >
                                              {line}
                                            </a>
                                          ) : (
                                            line
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-700">-</p>
                                )}
                              </div>
                            </div>
                          ) : null}

		                        {isExpanded ? (
		                          <div className="bg-white/70 px-4 py-4">
		                            {renderTaskEditor()}
		                          </div>
		                        ) : null}
		                      </div>
		                    );
		                  })}
		                </div>
		              ) : !taskEditorOpen ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center">
                  <p className="text-sm font-medium text-slate-700">No tasks added yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Add tasks one by one using the field below.
                  </p>
                </div>
              ) : null}

	              {!readOnly ? (
	                <div className="space-y-2">
			                  {!taskEditorOpen ? (
			                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
			                      <Button
			                        type="button"
			                        onClick={() => {
			                          resetTaskEditor();
			                          setTaskEditorOpen(true);
			                        }}
			                        className="h-12 w-full justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
			                      >
			                        <Plus className="h-4 w-4" />
			                        Add task
			                      </Button>
			                    </div>
			                  ) : editingTaskIndex === null ? (
			                    renderTaskEditor()
			                  ) : null}
		                </div>
	              ) : null}
	            </div>
	          </div>

          {!hideActions ? (
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={submitting || readOnly || !hasProjects}
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
                disabled={submitting || readOnly || !hasProjects || !hasTasks || taskEditorOpen}
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
          {!hideActions && !readOnly && !hasProjects ? (
            <p className="pt-2 text-xs text-slate-500">
              Select at least one project before saving or submitting.
            </p>
          ) : null}
          {!hideActions && !readOnly && hasProjects && !hasTasks ? (
            <p className="pt-2 text-xs text-slate-500">Add at least one accomplished task before submitting.</p>
          ) : null}
        </div>
      </div>

    </>
  );
}
