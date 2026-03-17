import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PAGE_MARGIN = 42;
const PAGE_WIDTH = 595.28;
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
};

type DtrProfile = { full_name?: string | null };
type DtrProject = { name?: string | null };

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

function drawMetric(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
) {
  doc
    .roundedRect(x, y, width, 62, 14)
    .fillAndStroke(COLORS.panel, COLORS.panelBorder);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text(label, x + 14, y + 14, { width: width - 28 });
  doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.ink).text(value, x + 14, y + 28, { width: width - 28 });
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
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    if (profile?.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: entry, error } = await supabase
      .from("dtr_entries")
      .select(
        "id, week_start, week_end, work_date, start_time, end_time, project_account, notes, image_link, duration_minutes, status, profiles(full_name), projects(name)",
      )
      .eq("id", (await params).id)
      .single();

    if (error || !entry) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const employeeProfile: DtrProfile | undefined = Array.isArray(entry.profiles)
      ? entry.profiles[0]
      : entry.profiles;
    const project: DtrProject | undefined = Array.isArray(entry.projects)
      ? entry.projects[0]
      : entry.projects;

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
    });

    doc.rect(0, 0, PAGE_WIDTH, 108).fill(COLORS.header);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(12).text("PH SEO Parttimer", PAGE_MARGIN, 28);
    doc.fontSize(24).text("Daily Time Record", PAGE_MARGIN, 48);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#E2E8F0")
      .text(`DTR ID: ${entry.id}`, PAGE_MARGIN, 82, { width: 280 });

    doc
      .roundedRect(PAGE_MARGIN, 122, 148, 28, 14)
      .fillAndStroke(COLORS.accentSoft, COLORS.accentSoft);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.accent)
      .text("Manager export", PAGE_MARGIN + 16, 131);

    drawMetric(doc, PAGE_MARGIN, 176, "EMPLOYEE", employeeProfile?.full_name ?? "Employee", 156);
    drawMetric(doc, PAGE_MARGIN + 168, 176, "WORK DATE", formatDate(entry.work_date), 126);
    drawMetric(doc, PAGE_MARGIN + 306, 176, "STATUS", entry.status === "submitted" ? "Submitted" : "Draft", 108);
    drawMetric(doc, PAGE_MARGIN + 426, 176, "DURATION", `${entry.duration_minutes} mins`, 86);

    doc
      .roundedRect(PAGE_MARGIN, 262, CONTENT_WIDTH, 118, 16)
      .fillAndStroke(COLORS.panel, COLORS.panelBorder);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text("Work summary", PAGE_MARGIN + 18, 278);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text("WEEK RANGE", PAGE_MARGIN + 18, 304);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(COLORS.ink)
      .text(`${formatDate(entry.week_start)} - ${formatDate(entry.week_end)}`, PAGE_MARGIN + 18, 318);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text("PROJECT", PAGE_MARGIN + 220, 304);
    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(COLORS.ink)
      .text(entry.project_account ?? project?.name ?? "-", PAGE_MARGIN + 220, 318, { width: 270 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text("START", PAGE_MARGIN + 18, 344);
    doc.font("Helvetica").fontSize(12).fillColor(COLORS.ink).text(formatTime(entry.start_time), PAGE_MARGIN + 18, 358);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text("END", PAGE_MARGIN + 130, 344);
    doc.font("Helvetica").fontSize(12).fillColor(COLORS.ink).text(formatTime(entry.end_time), PAGE_MARGIN + 130, 358);

    doc
      .roundedRect(PAGE_MARGIN, 398, CONTENT_WIDTH, 128, 16)
      .fillAndStroke("white", COLORS.line);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text("Notes", PAGE_MARGIN + 18, 416);
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(COLORS.ink)
      .text(entry.notes?.trim() || "No notes provided.", PAGE_MARGIN + 18, 438, {
        width: CONTENT_WIDTH - 36,
        height: 72,
      });

    doc
      .roundedRect(PAGE_MARGIN, 544, CONTENT_WIDTH, 76, 16)
      .fillAndStroke(COLORS.panel, COLORS.panelBorder);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text("Reference link", PAGE_MARGIN + 18, 562);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(entry.image_link ? "#2563EB" : COLORS.muted)
      .text(entry.image_link ?? "No image link attached.", PAGE_MARGIN + 18, 584, {
        width: CONTENT_WIDTH - 36,
        link: entry.image_link ?? undefined,
        underline: Boolean(entry.image_link),
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text("Generated from the manager export view for internal record review.", PAGE_MARGIN, 794, {
        width: CONTENT_WIDTH,
        align: "center",
      });

    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=dtr-${entry.id}.pdf`,
      },
    });
  } catch (error) {
    console.error("dtr export failed", error);
    return NextResponse.json({ error: "Failed to export PDF" }, { status: 500 });
  }
}
