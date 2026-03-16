import {
  addDays,
  differenceInMinutes,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isMonday,
  parse,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

export function weekRangeFromDate(date: Date) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  return { weekStart, weekEnd };
}

export function formatWeekRange(weekStart: string | Date) {
  const date = typeof weekStart === "string" ? parseISO(weekStart) : weekStart;
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(date, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
}

export function ensureMonday(date: Date) {
  return isMonday(date)
    ? date
    : startOfWeek(date, {
        weekStartsOn: 1,
      });
}

export function computeWeekEnd(weekStart: Date) {
  return addDays(weekStart, 6);
}

export function calculateDurationMinutes(
  startTime?: string | null,
  endTime?: string | null,
) {
  if (!startTime || !endTime) return 0;
  const start = parse(startTime, "HH:mm", new Date());
  let end = parse(endTime, "HH:mm", new Date());
  if (isBefore(end, start)) {
    end = addDays(end, 1); // overnight shift
  }
  return differenceInMinutes(end, start);
}

export function formatMinutes(mins: number) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${hours}h ${minutes}m`;
}

export function isWithinWeek(target: string, weekStart: string, weekEnd: string) {
  const t = parseISO(target);
  return (
    !isBefore(t, startOfDay(parseISO(weekStart))) &&
    !isAfter(t, startOfDay(parseISO(weekEnd)))
  );
}
