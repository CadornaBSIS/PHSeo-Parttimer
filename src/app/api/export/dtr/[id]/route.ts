import { NextResponse } from "next/server";
import { PDFDocument as LibPdfDocument, StandardFonts, rgb } from "pdf-lib";
import PDFDocument from "pdfkit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMinutes } from "@/utils/date";

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
  white: "#FFFFFF",
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
    .roundedRect(x, y, width, 70, 16)
    .fillAndStroke(COLORS.panel, COLORS.panelBorder);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.muted).text(label, x + 16, y + 16, { width: width - 32 });
  doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.ink).text(value, x + 16, y + 34, { width: width - 32 });
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
  doc.font("Helvetica").fontSize(12).fillColor(COLORS.ink).text(value, x, y + 14, { width });
}

function drawSummaryChip(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
) {
  doc
    .roundedRect(x, y, width, 42, 14)
    .fillAndStroke(COLORS.white, COLORS.line);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.muted).text(label, x + 14, y + 10, {
    width: width - 28,
  });
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.ink).text(value, x + 14, y + 22, {
    width: width - 28,
  });
}

function measureTextHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: "Helvetica" | "Helvetica-Bold",
  fontSize: number,
  lineGap = 0,
) {
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap });
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
      .select("role, full_name")
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

    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
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
      .roundedRect(PAGE_MARGIN, 126, 206, 32, 16)
      .fillAndStroke(COLORS.accentSoft, COLORS.accentSoft);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.accent)
      .text("Manager export - Internal use only", PAGE_MARGIN + 18, 138);

    drawMetric(doc, PAGE_MARGIN, 182, "EMPLOYEE", employeeProfile?.full_name ?? "Employee", 224);
    drawMetric(doc, PAGE_MARGIN + 238, 182, "WORK DATE", formatDate(entry.work_date), 138);
    drawMetric(doc, PAGE_MARGIN + 390, 182, "STATUS", entry.status === "submitted" ? "Submitted" : "Draft", 121);

    const workSummaryY = 276;
    const weekRangeValue = `${formatDate(entry.week_start)} - ${formatDate(entry.week_end)}`;
    const projectAccountValue = entry.project_account ?? project?.name ?? "-";
    const weekWidth = 156;
    const projectWidth = 250;
    const weekX = PAGE_MARGIN + 20;
    const projectX = PAGE_MARGIN + 214;
    const summaryLabelY = workSummaryY + 50;
    const summaryValueY = summaryLabelY + 14;
    const weekHeight = measureTextHeight(doc, weekRangeValue, weekWidth, "Helvetica", 12, 2);
    const projectHeight = measureTextHeight(doc, projectAccountValue, projectWidth, "Helvetica", 12, 2);
    const summaryTextHeight = Math.max(weekHeight, projectHeight);
    const summaryChipsY = summaryValueY + summaryTextHeight + 18;
    const summaryHeight = summaryChipsY + 42 + 18 - workSummaryY;

    doc
      .roundedRect(PAGE_MARGIN, workSummaryY, CONTENT_WIDTH, summaryHeight, 18)
      .fillAndStroke(COLORS.panel, COLORS.panelBorder);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text("Work summary", PAGE_MARGIN + 20, workSummaryY + 18);
    drawLabelValue(
      doc,
      weekX,
      summaryLabelY,
      "WEEK RANGE",
      weekRangeValue,
      weekWidth,
    );
    drawLabelValue(
      doc,
      projectX,
      summaryLabelY,
      "PROJECT / ACCOUNT",
      projectAccountValue,
      projectWidth,
    );
    drawSummaryChip(doc, PAGE_MARGIN + 20, summaryChipsY, "START", formatTime(entry.start_time), 108);
    drawSummaryChip(doc, PAGE_MARGIN + 140, summaryChipsY, "END", formatTime(entry.end_time), 108);
    drawSummaryChip(doc, PAGE_MARGIN + 260, summaryChipsY, "DURATION", formatMinutes(entry.duration_minutes), 122);

    const notesY = workSummaryY + summaryHeight + 20;
    const notesTitleY = notesY + 20;
    const notesTextY = notesTitleY + 24;
    const imageBlockHeight = 70;
    const imageBlockGap = 18;
    const footerReserve = 110;
    const maxNotesHeight = PAGE_HEIGHT - footerReserve - imageBlockHeight - imageBlockGap - notesTextY;
    const notesText = entry.notes?.trim() || "No notes provided.";
    let notesFontSize = 10;
    let notesLineGap = 6;
    let notesTextHeight = measureTextHeight(doc, notesText, CONTENT_WIDTH - 40, "Helvetica", notesFontSize, notesLineGap);

    while (notesTextHeight > maxNotesHeight && notesFontSize > 8) {
      notesFontSize -= 0.5;
      notesLineGap = Math.max(3, notesLineGap - 1);
      notesTextHeight = measureTextHeight(doc, notesText, CONTENT_WIDTH - 40, "Helvetica", notesFontSize, notesLineGap);
    }

    const notesHeight = Math.max(122, Math.min(maxNotesHeight + 24, notesTextHeight + 44));

    doc
      .roundedRect(PAGE_MARGIN, notesY, CONTENT_WIDTH, notesHeight, 18)
      .fillAndStroke("white", COLORS.line);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text("Notes", PAGE_MARGIN + 20, notesTitleY);
    doc
      .font("Helvetica")
      .fontSize(notesFontSize)
      .fillColor(COLORS.ink)
      .text(notesText, PAGE_MARGIN + 20, notesTextY, {
        width: CONTENT_WIDTH - 40,
        height: notesHeight - 44,
        lineGap: notesLineGap,
      });

    const imagesY = notesY + notesHeight + imageBlockGap;
    doc
      .roundedRect(PAGE_MARGIN, imagesY, CONTENT_WIDTH, imageBlockHeight, 18)
      .fillAndStroke(COLORS.panel, COLORS.panelBorder);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink).text("Images Link", PAGE_MARGIN + 20, imagesY + 20);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(entry.image_link ? "#2563EB" : COLORS.muted)
      .text(entry.image_link ?? "No image link attached.", PAGE_MARGIN + 20, imagesY + 42, {
        width: CONTENT_WIDTH - 40,
        link: entry.image_link ?? undefined,
        underline: Boolean(entry.image_link),
        lineGap: 2,
      });

    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    const normalizedPdf = await LibPdfDocument.load(pdfBuffer);
    while (normalizedPdf.getPageCount() > 1) {
      normalizedPdf.removePage(normalizedPdf.getPageCount() - 1);
    }

    const footerText = "Generated from the manager export view for internal record review,";
    const managerName = (profile.full_name ?? "").replace(/\s+/g, " ").trim();
    const managerMark = managerName ? `Manager ${managerName}` : "Manager";
    const page = normalizedPdf.getPage(0);
    const helvetica = await normalizedPdf.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await normalizedPdf.embedFont(StandardFonts.HelveticaBold);
    const footerFontSize = 8;
    const managerFontSize = 8;
    const footerTextWidth = helvetica.widthOfTextAtSize(footerText, footerFontSize);
    const managerTextWidth = helveticaBold.widthOfTextAtSize(managerMark, managerFontSize);

    page.drawText(footerText, {
      x: PAGE_MARGIN + (CONTENT_WIDTH - footerTextWidth) / 2,
      y: 24,
      size: footerFontSize,
      font: helvetica,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });
    page.drawText(managerMark, {
      x: PAGE_WIDTH - PAGE_MARGIN - managerTextWidth,
      y: 18,
      size: managerFontSize,
      font: helveticaBold,
      color: rgb(148 / 255, 163 / 255, 184 / 255),
      opacity: 0.55,
    });

    const singlePagePdf = await normalizedPdf.save();

    return new NextResponse(new Uint8Array(singlePagePdf), {
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
