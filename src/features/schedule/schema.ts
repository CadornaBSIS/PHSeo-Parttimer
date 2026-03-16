import { addDays, isMonday, parseISO, format } from "date-fns";
import { z } from "zod";

export const scheduleDaySchema = z
  .object({
    day_of_week: z.number().min(1).max(7),
    work_date: z.string(),
    work_status: z.enum([
      "working",
      "day_off",
      "leave",
      "holiday",
      "requested",
    ]),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.work_status === "working") {
      if (!val.start_time) {
        ctx.addIssue({
          path: ["start_time"],
          code: "custom",
          message: "Start time required when working",
        });
      }
      if (!val.end_time) {
        ctx.addIssue({
          path: ["end_time"],
          code: "custom",
          message: "End time required when working",
        });
      }
    }
  });

export const scheduleFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    week_start: z.string(),
    week_end: z.string(),
    days: z.array(scheduleDaySchema).length(7),
  })
  .superRefine((val, ctx) => {
    const start = parseISO(val.week_start);
    if (!isMonday(start)) {
      ctx.addIssue({
        path: ["week_start"],
        code: "custom",
        message: "Week must start on Monday",
      });
    }
    if (val.week_end !== format(addDays(start, 6), "yyyy-MM-dd")) {
      ctx.addIssue({
        path: ["week_end"],
        code: "custom",
        message: "Week end must be week start + 6 days",
      });
    }
  });

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;
