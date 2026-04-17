"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlarmClock,
  ArrowRight,
  Coffee,
  LogIn,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import {
  getTimeClockStatusAction,
  startBreakAction,
  timeInAction,
  endDayAction,
  type TimeClockStatus,
} from "@/features/timeclock/actions";

function formatManilaTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatManilaLongDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, totalMinutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TimeInOutPanel() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<TimeClockStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const inFlightRef = useRef(false);

  const load = useCallback((mode: "foreground" | "background" = "foreground") => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mode === "foreground") setLoading(true);
    startTransition(async () => {
      try {
        const result = await getTimeClockStatusAction();
        if (!result.ok) {
          toast.error(result.error);
          setStatus(null);
          return;
        }
        setStatus(result.data ?? null);
      } catch {
        toast.error("Failed to load time clock status.");
        setStatus(null);
      } finally {
        if (mode === "foreground") setLoading(false);
        inFlightRef.current = false;
      }
    });
  }, [startTransition]);

  useEffect(() => {
    load("foreground");
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onFocus = () => load("background");
    const onVisibility = () => {
      if (document.visibilityState === "visible") load("background");
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const intervalId = window.setInterval(() => load("background"), 60000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, [load]);
  const stateLabel = useMemo(() => {
    if (!status) return "Loading";
    if (status.dayEnded) return "Completed";
    if (status.openSessionId) return "Working";
    if (status.sessions.length) return "On break";
    return "Not started";
  }, [status]);

  const stateVariant = useMemo(() => {
    if (!status) return "muted" as const;
    if (status.dayEnded) return "secondary" as const;
    if (status.openSessionId) return "success" as const;
    if (status.sessions.length) return "warning" as const;
    return "muted" as const;
  }, [status]);

  const canTimeIn = Boolean(status?.hasScheduleForToday) && !status?.openSessionId && !status?.dayEnded;
  const canStartBreak = Boolean(status?.openSessionId) && !status?.breakUsed && !status?.dayEnded;
  const canEndDay = Boolean(status?.openSessionId);
  const showBreakButton = Boolean(status?.openSessionId) && !status?.dayEnded && !status?.breakUsed;
  const timeInButtonLabel = useMemo(() => {
    if (status?.openSessionId) return "Working";
    if (status?.sessions?.length) return "Resume work";
    return "Time in";
  }, [status?.openSessionId, status?.sessions?.length]);

  const activeWorkedMinutes = useMemo(() => {
    if (!status?.openTimeIn) return 0;
    const startMs = new Date(status.openTimeIn).getTime();
    const minutes = Math.max(0, Math.floor((now - startMs) / 60000));
    return minutes;
  }, [status?.openTimeIn, now]);

  const totalWithActive = useMemo(() => {
    const base = status?.totalWorkedMinutes ?? 0;
    return status?.openTimeIn ? base + activeWorkedMinutes : base;
  }, [status?.totalWorkedMinutes, status?.openTimeIn, activeWorkedMinutes]);

  const timeInText = useMemo(() => {
    if (!status?.openTimeIn) return null;
    return `Timed in at ${formatManilaTime(status.openTimeIn)}`;
  }, [status?.openTimeIn]);

  const lastTimeOutText = useMemo(() => {
    if (!status?.latestTimeOut) return null;
    return `Last time out at ${formatManilaTime(status.latestTimeOut)}`;
  }, [status?.latestTimeOut]);

  const headlineText = useMemo(() => {
    if (timeInText) return timeInText;
    if (status?.dayEnded) return "Day completed.";
    if (status?.sessions?.length) return "On break.";
    return "Not timed in yet.";
  }, [status?.dayEnded, status?.sessions?.length, timeInText]);

  const sessions = useMemo(() => {
    return (status?.sessions ?? []).map((sessionRow) => {
      const startMs = new Date(sessionRow.time_in).getTime();
      const endMs = sessionRow.time_out ? new Date(sessionRow.time_out).getTime() : null;
      const minutes = endMs ? Math.max(0, Math.floor((endMs - startMs) / 60000)) : null;
      return {
        ...sessionRow,
        minutes,
      };
    });
  }, [status?.sessions]);

  const todayTitle = status ? formatManilaLongDate(status.today) : "Today";
  const manilaNow = useMemo(() => {
    return new Date(now).toLocaleTimeString("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [now]);

  return (
    <div className="grid gap-4">
      <Card className={cn("overflow-hidden border-slate-200 p-0", loading ? "opacity-90" : "")}>
        <div className="bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">Time Record</p>
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{todayTitle}</h2>
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <AlarmClock className="h-4 w-4" />
                  {manilaNow} (Manila)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                <Badge variant={stateVariant}>{stateLabel}</Badge>
                {status?.hasScheduleForToday ? (
                  <Badge variant="success">Scheduled</Badge>
                ) : (
                  <Badge variant="danger">No schedule</Badge>
                )}
                {status?.hasDtrForToday ? (
                  <Badge variant="success">DTR ready</Badge>
                ) : (
                  <Badge variant="outline">DTR required</Badge>
                )}
                {status?.breakUsed ? <Badge variant="warning">Break used</Badge> : null}
              </div>

              <div className="grid gap-1 text-sm text-slate-700">
                <p className="font-medium">{headlineText}</p>
                {lastTimeOutText ? <p className="text-slate-600">{lastTimeOutText}</p> : null}
                {!status?.hasScheduleForToday && status?.scheduleMessage ? (
                  <p className="flex items-center gap-2 text-slate-600">
                    <ShieldAlert className="h-4 w-4" />
                    {status.scheduleMessage}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {!status?.hasScheduleForToday ? (
                <Button asChild type="button" variant="outline" disabled={pending}>
                  <Link href="/schedule">
                    View schedule
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
              {!status?.hasDtrForToday ? (
                <Button asChild type="button" variant="outline" disabled={pending}>
                  <Link href="/dtr/new">
                    Create DTR
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 h-px w-full bg-slate-200/70" />

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Worked today</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {status ? formatMinutes(totalWithActive) : "--"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {status?.openTimeIn ? "Includes active session." : "Sum of completed sessions."}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900/5 p-2 text-slate-700 ring-1 ring-slate-900/10">
                  <AlarmClock className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Sessions</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {status ? status.sessions.length : "--"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Work blocks separated by breaks.</p>
                </div>
                <div className="rounded-2xl bg-slate-900/5 p-2 text-slate-700 ring-1 ring-slate-900/10">
                  <Coffee className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Status</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {status ? stateLabel : "--"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {status?.openTimeIn ? `Today: ${formatMinutes(totalWithActive)}` : "No active session."}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900/5 p-2 text-slate-700 ring-1 ring-slate-900/10">
                  <AlarmClock className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          <div className={cn("mt-5 grid gap-3", showBreakButton ? "md:grid-cols-3" : "md:grid-cols-2")}>
            <Button
              type="button"
              className="h-12 w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={pending || loading || !canTimeIn}
              onClick={() => {
                startTransition(async () => {
                  const result = await timeInAction();
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(status?.sessions?.length ? "Resumed work." : "Timed in.");
                  load("background");
                });
              }}
            >
              <LogIn className="h-4 w-4" />
              {timeInButtonLabel}
            </Button>

            {showBreakButton ? (
              <Button
                type="button"
                className="h-12 w-full rounded-2xl"
                variant="outline"
                disabled={pending || loading || !canStartBreak}
                onClick={() => {
                  startTransition(async () => {
                    const result = await startBreakAction();
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Break started.");
                    load("background");
                  });
                }}
              >
                <Coffee className="h-4 w-4" />
                Start break
              </Button>
            ) : null}

            <Button
              type="button"
              className="h-12 w-full rounded-2xl"
              variant="destructive"
              disabled={pending || loading || !canEndDay}
              onClick={() => {
                startTransition(async () => {
                  if (!status?.hasDtrForToday) {
                    toast.error("DTR required");
                    return;
                  }
                  const result = await endDayAction();
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Timed out.");
                  load("background");
                });
              }}
            >
              <LogOut className="h-4 w-4" />
              Time out
            </Button>
          </div>

          {/* Break usage is already shown via the "Break used" badge to avoid redundant messages. */}
        </div>
      </Card>

      <Card className={cn(loading ? "opacity-75" : "")}>
        <CardHeader>
          <CardTitle>Today’s sessions</CardTitle>
          <p className="text-sm text-slate-500">
            {sessions.length ? "Work sessions recorded for today." : "No sessions yet."}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((sessionRow, index) => (
            <div
              key={sessionRow.id}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
                !sessionRow.time_out ? "ring-2 ring-emerald-500/30" : "",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 h-9 w-9 shrink-0 rounded-2xl ring-1",
                      sessionRow.time_out
                        ? "bg-slate-900/5 text-slate-700 ring-slate-900/10"
                        : "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
                    )}
                  >
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      Session {index + 1}{" "}
                      {!sessionRow.time_out ? (
                        <span className="ml-2 text-xs font-medium text-emerald-700">Active</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatManilaTime(sessionRow.time_in)}{" "}
                      {sessionRow.time_out
                        ? `→ ${formatManilaTime(sessionRow.time_out)}`
                        : "→ (ongoing)"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  <Badge variant={sessionRow.time_out ? "secondary" : "success"}>
                    {sessionRow.minutes === null ? "In progress" : formatMinutes(sessionRow.minutes)}
                  </Badge>
                </div>
              </div>
            </div>
          ))}

          {!sessions.length ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">No sessions yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Use <span className="font-medium">Time in</span> to start your day, then take breaks as needed.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
