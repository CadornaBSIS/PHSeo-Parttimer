import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ScheduleDay = {
  day_of_week: number;
  work_date: string;
  work_status: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
};

type ScheduleProfile = {
  full_name?: string | null;
  role?: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: schedule, error } = await supabase
    .from("schedules")
    .select(
      "id, week_start, week_end, status, submitted_at, profiles(full_name, role), schedule_days(*)",
    )
    .eq("id", (await params).id)
    .single();

  if (error || !schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const employeeProfile: ScheduleProfile | undefined = Array.isArray(schedule.profiles)
    ? schedule.profiles[0]
    : schedule.profiles;

  const scheduleDays: ScheduleDay[] = Array.isArray(schedule.schedule_days)
    ? (schedule.schedule_days as ScheduleDay[])
    : [];

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  doc
    .fontSize(18)
    .fillColor("#111827")
    .text("ViteSeo Parttimer - Weekly Schedule", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#EF4444").text("Manager export • Internal use only");
  doc.moveDown();

  doc.fontSize(12).fillColor("#111827");
  doc.text(`Employee: ${employeeProfile?.full_name ?? "Employee"}`);
  doc.text(`Role: ${employeeProfile?.role ?? "-"}`);
  doc.text(`Week: ${schedule.week_start} - ${schedule.week_end}`);
  doc.text(`Status: ${schedule.status}`);
  if (schedule.submitted_at) {
    doc.text(`Submitted at: ${new Date(schedule.submitted_at).toLocaleString()}`);
  }

  doc.moveDown();

  // Table headers
  doc
    .fontSize(11)
    .fillColor("#111827")
    .text("Day", 50, doc.y, { continued: true })
    .text("Date", 100, doc.y, { continued: true })
    .text("Status", 180, doc.y, { continued: true })
    .text("Start", 270, doc.y, { continued: true })
    .text("End", 340, doc.y, { continued: true })
    .text("Notes", 410, doc.y);

  doc.moveDown(0.5);
  doc.strokeColor("#E5E7EB").moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(0.5);

  scheduleDays
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .forEach((day) => {
      doc
        .fontSize(10)
        .fillColor("#111827")
        .text(String(day.day_of_week), 50, doc.y, { continued: true })
        .text(day.work_date, 100, doc.y, { continued: true })
        .text(day.work_status, 180, doc.y, { continued: true })
        .text(day.start_time ?? "-", 270, doc.y, { continued: true })
        .text(day.end_time ?? "-", 340, doc.y, { continued: true })
        .text(day.notes ?? "", 410, doc.y);
      doc.moveDown(0.5);
    });

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });

  const pdfBody = new Uint8Array(pdfBuffer);

  return new NextResponse(pdfBody, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=schedule-${schedule.id}.pdf`,
    },
  });
}
