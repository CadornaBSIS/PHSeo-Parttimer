import { isAfter, isBefore, parseISO } from "date-fns";
import { z } from "zod";
import { parseImageLinks } from "./image-links";

export const dtrFormSchema = z
  .object({
    id: z.string().uuid().optional(),
    week_start: z.string(),
    week_end: z.string(),
    work_date: z.string(),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    project_account: z.string().min(1, "Project / account is required"),
    project_id: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
    image_link: z
      .string()
      .max(8000, "Image links are too long")
      .nullable()
      .optional()
      .superRefine((value, ctx) => {
        if (!value?.trim()) return;
        try {
          parseImageLinks(value, { strict: true });
        } catch (error) {
          ctx.addIssue({
            code: "custom",
            message:
              error instanceof Error
                ? `Invalid image links format: ${error.message}`
                : "Invalid image links format",
          });
        }
      }),
  })
  .superRefine((val, ctx) => {
    const start = parseISO(val.week_start);
    const end = parseISO(val.week_end);
    const workDate = parseISO(val.work_date);
    if (isBefore(workDate, start) || isAfter(workDate, end)) {
      ctx.addIssue({
        path: ["work_date"],
        code: "custom",
        message: "Work date must be within the selected week",
      });
    }
    if (val.start_time && !val.end_time) {
      ctx.addIssue({
        path: ["end_time"],
        code: "custom",
        message: "End time required when start time is set",
      });
    }
  });

export type DtrFormValues = z.infer<typeof dtrFormSchema>;
