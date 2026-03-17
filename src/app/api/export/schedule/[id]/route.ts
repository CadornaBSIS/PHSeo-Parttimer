import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PAGE_MARGIN = 42;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const COLORS = {
  ink: "#0F172A",
  muted: "#64748B",
  line: "#E2E8F0",
  panel: "#F8FAFC",
  panelBorder: "#CBD5E1",
  accent: "#DC2626",
  accentSoft: "#FEE2E2",
  header: "#111827",
  zebra: "#F8FAFC",
};

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

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Date(`1970-01-01T${value}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text(label, x, y, { width });
  doc.font("Helvetica").fontSize(12).fillColor(COLORS.ink).text(value, x, y + 12, { width });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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

    const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
    });

    doc.rect(0, 0, PAGE_WIDTH, 108).fill(COLORS.header);
    doc
      .fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("PH SEO Parttimer", PAGE_MARGIN, 28);
    doc
      .fontSize(24)
      .text("Weekly Schedule", PAGE_MARGIN, 48, { width: 280 });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#E2E8F0")
      .text(`Schedule ID: ${schedule.id}`, PAGE_MARGIN, 82, { width: 260 });

    doc
      .roundedRect(PAGE_MARGIN, 128, 184, 30, 15)
      .fillAndStroke(COLORS.accentSoft, COLORS.accentSoft);
    doc
      .fillColor(COLORS.accent)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Manager export - Internal use only", PAGE_MARGIN + 16, 139);

    doc
      .roundedRect(PAGE_MARGIN, 186, CONTENT_WIDTH, 102, 16)
      .fillAndStroke(COLORS.panel, COLORS.panelBorder);

    const infoTop = 204;
    const infoWidth = 150;
    drawLabelValue(doc, PAGE_MARGIN + 20, infoTop, "EMPLOYEE", employeeProfile?.full_name ?? "Employee", infoWidth);
    drawLabelValue(doc, PAGE_MARGIN + 170, infoTop, "ROLE", employeeProfile?.role ?? "-", infoWidth);
    drawLabelValue(
      doc,
      PAGE_MARGIN + 320,
      infoTop,
      "WEEK",
      `${formatDate(schedule.week_start)} - ${formatDate(schedule.week_end)}`,
      190,
    );
    drawLabelValue(
      doc,
      PAGE_MARGIN + 20,
      infoTop + 46,
      "STATUS",
      schedule.status === "submitted" ? "Submitted" : "Draft",
      infoWidth,
    );
    drawLabelValue(
      doc,
      PAGE_MARGIN + 170,
      infoTop + 46,
      "SUBMITTED",
      schedule.submitted_at ? new Date(schedule.submitted_at).toLocaleString() : "Not submitted",
      340,
    );

    const sectionTitleY = 308;
    const tableTop = 338;
    const columns = [
      { label: "Day", key: "day", x: PAGE_MARGIN + 18, width: 42 },
      { label: "Date", key: "date", x: PAGE_MARGIN + 72, width: 92 },
      { label: "Status", key: "status", x: PAGE_MARGIN + 176, width: 94 },
      { label: "Start", key: "start", x: PAGE_MARGIN + 282, width: 70 },
      { label: "End", key: "end", x: PAGE_MARGIN + 364, width: 70 },
      { label: "Notes", key: "notes", x: PAGE_MARGIN + 446, width: 90 },
    ];

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(COLORS.ink)
      .text("Weekly breakdown", PAGE_MARGIN, sectionTitleY);
    doc
      .strokeColor(COLORS.line)
      .lineWidth(1)
      .moveTo(PAGE_MARGIN + 148, sectionTitleY + 9)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, sectionTitleY + 9)
      .stroke();

    doc
      .roundedRect(PAGE_MARGIN, tableTop, CONTENT_WIDTH, 28, 10)
      .fillAndStroke(COLORS.header, COLORS.header);

    for (const column of columns) {
      doc
        .fillColor("white")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(column.label, column.x, tableTop + 9, { width: column.width });
    }

    let rowY = tableTop + 36;
    const rowHeight = 32;
    scheduleDays.sort((a, b) => a.day_of_week - b.day_of_week).forEach((day, index) => {
      const rowFill = index % 2 === 0 ? "white" : COLORS.zebra;
      doc
        .roundedRect(PAGE_MARGIN, rowY, CONTENT_WIDTH, rowHeight, 8)
        .fillAndStroke(rowFill, COLORS.line);

      const noteText = day.notes?.trim() ? day.notes : "-";
      const values = [
        String(day.day_of_week),
        formatDate(day.work_date),
        day.work_status.replaceAll("_", " "),
        formatTime(day.start_time),
        formatTime(day.end_time),
        noteText,
      ];

      columns.forEach((column, columnIndex) => {
        doc
          .fillColor(COLORS.ink)
          .font(column.key === "status" ? "Helvetica-Bold" : "Helvetica")
          .fontSize(10)
          .text(values[columnIndex], column.x, rowY + 9, {
            width: column.width,
            ellipsis: true,
          });
      });

      rowY += rowHeight + 8;
      if (rowY > PAGE_HEIGHT - PAGE_MARGIN - 80 && index < scheduleDays.length - 1) {
        doc.addPage({ margin: PAGE_MARGIN });
        rowY = PAGE_MARGIN + 24;
      }
    });

    const footerY = PAGE_HEIGHT - PAGE_MARGIN - 14;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(
        "Generated from the manager export view for internal scheduling review.",
        PAGE_MARGIN,
        footerY,
        { width: CONTENT_WIDTH, align: "center" },
      );

    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=schedule-${schedule.id}.pdf`,
      },
    });
  } catch (error) {
    console.error("schedule export failed", error);
    return NextResponse.json({ error: "Failed to export PDF" }, { status: 500 });
  }
}
