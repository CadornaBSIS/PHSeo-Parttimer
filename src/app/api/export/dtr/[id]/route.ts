import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { PDFDocument as LibPdfDocument, StandardFonts, rgb } from "pdf-lib";
import PDFDocument from "pdfkit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMinutes } from "@/utils/date";
import { parseTaskBlock, splitTaskBlocks, type ParsedTaskBlock } from "@/features/dtr/task-blocks";

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

const FONT_REGULAR_NAME = "NanumGothic-Regular";
const FONT_BOLD_NAME = "NanumGothic-Bold";
const FONT_REGULAR_PATH = path.join(process.cwd(), "public", "fonts", "NanumGothic-Regular.ttf");
const FONT_BOLD_PATH = path.join(process.cwd(), "public", "fonts", "NanumGothic-Bold.ttf");

function registerFonts(doc: PDFKit.PDFDocument) {
  try {
    const regularBytes = fs.readFileSync(FONT_REGULAR_PATH);
    const boldBytes = fs.readFileSync(FONT_BOLD_PATH);
    doc.registerFont(FONT_REGULAR_NAME, regularBytes);
    doc.registerFont(FONT_BOLD_NAME, boldBytes);
  } catch (error) {
    console.error("Failed to register Nanum Gothic fonts, falling back to built-in Helvetica.", error);
  }
}

type DtrProfile = { full_name?: string | null };
type DtrProject = { name?: string | null };

function slugifyFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function formatFileDate(value: string) {
  return value;
}

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
  doc.font(FONT_BOLD_NAME).fontSize(8).fillColor(COLORS.muted).text(label, x + 16, y + 16, { width: width - 32 });
  doc.font(FONT_BOLD_NAME).fontSize(16).fillColor(COLORS.ink).text(value, x + 16, y + 34, { width: width - 32 });
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
) {
  doc.font(FONT_BOLD_NAME).fontSize(8).fillColor(COLORS.muted).text(label, x, y, { width });
  doc.font(FONT_REGULAR_NAME).fontSize(12).fillColor(COLORS.ink).text(value, x, y + 14, { width });
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
  doc.font(FONT_BOLD_NAME).fontSize(7).fillColor(COLORS.muted).text(label, x + 14, y + 10, {
    width: width - 28,
  });
  doc.font(FONT_REGULAR_NAME).fontSize(11).fillColor(COLORS.ink).text(value, x + 14, y + 22, {
    width: width - 28,
  });
}

function measureTextHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: string,
  fontSize: number,
  lineGap = 0,
) {
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap });
}

const FOOTER_RESERVE = 110;
const CONTENT_BOTTOM = PAGE_HEIGHT - FOOTER_RESERVE;
const SECTION_GAP = 18;
const SECTION_INNER_WIDTH = CONTENT_WIDTH - 40;

type TaskCardLine = {
  text: string;
  font: string;
  fontSize: number;
  color: string;
  height: number;
  lineGap: number;
  link?: string;
  underline?: boolean;
};

function drawOverflowPageHeader(
  doc: PDFKit.PDFDocument,
  entryId: string,
  workDate: string,
  employeeName: string,
) {
  doc.addPage();
  doc.rect(0, 0, PAGE_WIDTH, 92).fill(COLORS.header);
  doc.fillColor("white").font(FONT_BOLD_NAME).fontSize(12).text("PH SEO Parttimer", PAGE_MARGIN, 24);
  doc.fontSize(16).text("Daily Time Record (continued)", PAGE_MARGIN, 42);
  doc
    .font(FONT_REGULAR_NAME)
    .fontSize(9)
    .fillColor("#E2E8F0")
    .text(`DTR ID: ${entryId}`, PAGE_MARGIN, 66, { width: 240 });
  doc
    .font(FONT_REGULAR_NAME)
    .fontSize(9)
    .fillColor("#CBD5E1")
    .text(`${employeeName} - ${formatDate(workDate)}`, PAGE_MARGIN + 240, 66, {
      width: CONTENT_WIDTH - 240,
      align: "right",
    });
}

function wrapTextByWidth(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: string,
  fontSize: number,
) {
  doc.font(font).fontSize(fontSize);
  const lines: string[] = [];
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const char of paragraph) {
      const next = current + char;
      if (!current || doc.widthOfString(next) <= width) {
        current = next;
      } else {
        lines.push(current);
        current = char;
      }
    }
    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function extractHttpsUrl(value: string) {
  const match = value.match(/https:\/\/\S+/i);
  if (!match) return null;
  return match[0].replace(/[),.;]+$/, "");
}

async function embedFooterFonts(pdf: LibPdfDocument) {
  try {
    const regularBytes = fs.readFileSync(FONT_REGULAR_PATH);
    const boldBytes = fs.readFileSync(FONT_BOLD_PATH);
    const regular = await pdf.embedFont(regularBytes);
    const bold = await pdf.embedFont(boldBytes);
    return { regular, bold };
  } catch {
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    return { regular, bold };
  }
}

function drawPaginatedTextSection(params: {
  doc: PDFKit.PDFDocument;
  title: string;
  lines: string[];
  currentY: number;
  lineGap: number;
  lineHeight: number;
  textFontSize: number;
  textColor: string;
  onNewPage: () => void;
}) {
  const { doc, title, lineGap, lineHeight, textFontSize, textColor, onNewPage } = params;
  let currentY = params.currentY;
  let pending = [...params.lines];
  let continuation = false;

  while (pending.length) {
    const headerHeight = 44;
    const minBodyHeight = lineHeight;
    if (currentY + headerHeight + minBodyHeight + 14 > CONTENT_BOTTOM) {
      onNewPage();
      currentY = 112;
    }

    const availableBody = CONTENT_BOTTOM - currentY - headerHeight - 14;
    const linesPerPage = Math.max(1, Math.floor((availableBody + lineGap) / lineHeight));
    const chunk = pending.slice(0, linesPerPage);
    pending = pending.slice(linesPerPage);

    const bodyHeight = Math.max(lineHeight, chunk.length * lineHeight - lineGap);
    const sectionHeight = headerHeight + bodyHeight + 14;

    doc
      .roundedRect(PAGE_MARGIN, currentY, CONTENT_WIDTH, sectionHeight, 18)
      .fillAndStroke("white", COLORS.line);
    doc
      .font(FONT_BOLD_NAME)
      .fontSize(11)
      .fillColor(COLORS.ink)
      .text(continuation ? `${title} (continued)` : title, PAGE_MARGIN + 20, currentY + 20);

    let textY = currentY + 44;
    chunk.forEach((line) => {
      doc
        .font(FONT_REGULAR_NAME)
        .fontSize(textFontSize)
        .fillColor(textColor)
        .text(line || " ", PAGE_MARGIN + 20, textY, {
          width: SECTION_INNER_WIDTH,
          lineGap,
        });
      textY += lineHeight;
    });

    currentY += sectionHeight + SECTION_GAP;
    continuation = true;
  }

  return currentY;
}

function buildTaskCardLines(doc: PDFKit.PDFDocument, task: ParsedTaskBlock) {
  const lines: TaskCardLine[] = [];

  const pushLabel = (label: string) => {
    lines.push({
      text: label,
      font: FONT_BOLD_NAME,
      fontSize: 8,
      color: COLORS.muted,
      height: 12,
      lineGap: 2,
    });
  };

  const pushBodyText = (text: string, options?: { fontSize?: number; color?: string }) => {
    const fontSize = options?.fontSize ?? 10;
    const color = options?.color ?? COLORS.ink;
    const wrapped = wrapTextByWidth(doc, text || "-", SECTION_INNER_WIDTH, FONT_REGULAR_NAME, fontSize);
    const height = fontSize <= 9 ? 13 : 14;
    const lineGap = fontSize <= 9 ? 2 : 4;
    wrapped.forEach((part) => {
      lines.push({
        text: part || " ",
        font: FONT_REGULAR_NAME,
        fontSize,
        color,
        height,
        lineGap,
      });
    });
  };

  const pushLinkLines = (rawLines: string[]) => {
    const entries = rawLines.filter(Boolean);
    if (!entries.length) {
      pushBodyText("-", { color: COLORS.ink });
      return;
    }

    entries.forEach((raw, index) => {
      const label = `${index + 1}. ${raw}`;
      const url = extractHttpsUrl(raw);
      const wrapped = wrapTextByWidth(doc, label, SECTION_INNER_WIDTH, FONT_REGULAR_NAME, 9);
      wrapped.forEach((part) => {
        lines.push({
          text: part || " ",
          font: FONT_REGULAR_NAME,
          fontSize: 9,
          color: "#2563EB",
          height: 13,
          lineGap: 2,
          link: url ?? undefined,
          underline: Boolean(url),
        });
      });
    });
  };

  pushLabel("DESCRIPTION");
  pushBodyText(task.description?.trim() ? task.description : "-");
  lines.push({
    text: " ",
    font: FONT_REGULAR_NAME,
    fontSize: 9,
    color: COLORS.ink,
    height: 10,
    lineGap: 0,
  });

  pushLabel("TITLE LINKS");
  pushLinkLines(task.titleLinks);
  lines.push({
    text: " ",
    font: FONT_REGULAR_NAME,
    fontSize: 9,
    color: COLORS.ink,
    height: 10,
    lineGap: 0,
  });

  pushLabel("IMAGE LINKS");
  pushLinkLines(task.imageLinks);

  return lines;
}

function drawPaginatedTaskCards(params: {
  doc: PDFKit.PDFDocument;
  tasks: ParsedTaskBlock[];
  currentY: number;
  onNewPage: () => void;
}) {
  const { doc, tasks, onNewPage } = params;
  let currentY = params.currentY;

  const headerHeight = 44;
  const paddingBottom = 14;

  for (let index = 0; index < tasks.length; index++) {
    const task = tasks[index];
    const sectionName = task.section?.trim() ? task.section.trim() : "Untitled task";
    const baseTitle = `Accomplished task ${index + 1}: ${sectionName}`;
    const allLines = buildTaskCardLines(doc, task);

    let pending = [...allLines];
    let continuation = false;

    while (pending.length) {
      const minBodyHeight = pending[0]?.height ?? 14;
      if (currentY + headerHeight + minBodyHeight + paddingBottom > CONTENT_BOTTOM) {
        onNewPage();
        currentY = 112;
      }

      const availableBody = CONTENT_BOTTOM - currentY - headerHeight - paddingBottom;
      let chunkHeight = 0;
      let take = 0;
      while (take < pending.length) {
        const next = pending[take];
        if (take > 0 && chunkHeight + next.height > availableBody) break;
        if (take === 0 && next.height > availableBody) {
          take = 1;
          chunkHeight = next.height;
          break;
        }
        chunkHeight += next.height;
        take++;
      }

      const chunk = pending.slice(0, take);
      pending = pending.slice(take);

      const sectionHeight = headerHeight + Math.max(14, chunkHeight) + paddingBottom;

      doc
        .roundedRect(PAGE_MARGIN, currentY, CONTENT_WIDTH, sectionHeight, 18)
        .fillAndStroke("white", COLORS.line);
      doc
        .font(FONT_BOLD_NAME)
        .fontSize(11)
        .fillColor(COLORS.ink)
        .text(
          continuation ? `${baseTitle} (continued)` : baseTitle,
          PAGE_MARGIN + 20,
          currentY + 20,
          { width: SECTION_INNER_WIDTH },
        );

      let textY = currentY + 44;
      chunk.forEach((line) => {
        doc
          .font(line.font)
          .fontSize(line.fontSize)
          .fillColor(line.color)
          .text(line.text, PAGE_MARGIN + 20, textY, {
            width: SECTION_INNER_WIDTH,
            lineGap: line.lineGap,
            link: line.link,
            underline: Boolean(line.underline),
          });
        textY += line.height;
      });

      currentY += sectionHeight + SECTION_GAP;
      continuation = true;
    }
  }

  return currentY;
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
    registerFonts(doc);
    const buffers: Buffer[] = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
    });

    doc.rect(0, 0, PAGE_WIDTH, 108).fill(COLORS.header);
    doc.fillColor("white").font(FONT_BOLD_NAME).fontSize(12).text("PH SEO Parttimer", PAGE_MARGIN, 28);
    doc.fontSize(24).text("Daily Time Record", PAGE_MARGIN, 48);
    doc
      .font(FONT_REGULAR_NAME)
      .fontSize(10)
      .fillColor("#E2E8F0")
      .text(`DTR ID: ${entry.id}`, PAGE_MARGIN, 82, { width: 280 });

    doc
      .roundedRect(PAGE_MARGIN, 126, 206, 32, 16)
      .fillAndStroke(COLORS.accentSoft, COLORS.accentSoft);
    doc
      .font(FONT_BOLD_NAME)
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
    const weekHeight = measureTextHeight(doc, weekRangeValue, weekWidth, FONT_REGULAR_NAME, 12, 2);
    const projectHeight = measureTextHeight(doc, projectAccountValue, projectWidth, FONT_REGULAR_NAME, 12, 2);
    const summaryTextHeight = Math.max(weekHeight, projectHeight);
    const summaryChipsY = summaryValueY + summaryTextHeight + 18;
    const summaryHeight = summaryChipsY + 42 + 18 - workSummaryY;

    doc
      .roundedRect(PAGE_MARGIN, workSummaryY, CONTENT_WIDTH, summaryHeight, 18)
      .fillAndStroke(COLORS.panel, COLORS.panelBorder);
    doc.font(FONT_BOLD_NAME).fontSize(11).fillColor(COLORS.ink).text("Work summary", PAGE_MARGIN + 20, workSummaryY + 18);
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
    const parsedTasks = splitTaskBlocks(entry.notes).map((block) =>
      parseTaskBlock(block, { ensureNonEmptyArrays: false }),
    );
    const hasTasks = parsedTasks.some(
      (task) =>
        Boolean(task.section?.trim()) ||
        Boolean(task.description?.trim()) ||
        task.titleLinks.length > 0 ||
        task.imageLinks.length > 0,
    );

    if (hasTasks) {
      drawPaginatedTaskCards({
        doc,
        tasks: parsedTasks,
        currentY: notesY,
        onNewPage: () =>
          drawOverflowPageHeader(
            doc,
            entry.id,
            entry.work_date,
            employeeProfile?.full_name ?? "Employee",
          ),
      });
    } else {
      drawPaginatedTextSection({
        doc,
        title: "Notes",
        lines: wrapTextByWidth(
          doc,
          entry.notes?.trim() || "No notes provided.",
          SECTION_INNER_WIDTH,
          FONT_REGULAR_NAME,
          10,
        ),
        currentY: notesY,
        lineGap: 6,
        lineHeight: 16,
        textFontSize: 10,
        textColor: COLORS.ink,
        onNewPage: () =>
          drawOverflowPageHeader(
            doc,
            entry.id,
            entry.work_date,
            employeeProfile?.full_name ?? "Employee",
          ),
      });
    }

    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    const normalizedPdf = await LibPdfDocument.load(pdfBuffer);

    const footerText = "Generated from the manager export view for internal record review,";
    const managerName = (profile.full_name ?? "").replace(/\s+/g, " ").trim();
    const managerMark = managerName ? `Manager ${managerName}` : "Manager";
    const footerFonts = await embedFooterFonts(normalizedPdf);
    const footerFontSize = 8;
    const managerFontSize = 8;
    const footerTextWidth = footerFonts.regular.widthOfTextAtSize(footerText, footerFontSize);
    const managerTextWidth = footerFonts.bold.widthOfTextAtSize(managerMark, managerFontSize);

    normalizedPdf.getPages().forEach((page) => {
      page.drawText(footerText, {
        x: PAGE_MARGIN + (CONTENT_WIDTH - footerTextWidth) / 2,
        y: 24,
        size: footerFontSize,
        font: footerFonts.regular,
        color: rgb(100 / 255, 116 / 255, 139 / 255),
      });
      page.drawText(managerMark, {
        x: PAGE_WIDTH - PAGE_MARGIN - managerTextWidth,
        y: 18,
        size: managerFontSize,
        font: footerFonts.bold,
        color: rgb(148 / 255, 163 / 255, 184 / 255),
        opacity: 0.55,
      });
    });

    const employeeName = employeeProfile?.full_name?.trim() || "employee";
    const filename = `ph-seo-parttimer-dtr-${slugifyFilenamePart(employeeName)}-${formatFileDate(entry.work_date)}.pdf`;
    normalizedPdf.setTitle(filename.replace(/\.pdf$/i, ""));
    normalizedPdf.setSubject("PH SEO Parttimer DTR export");
    normalizedPdf.setAuthor("PH SEO Parttimer");
    normalizedPdf.setProducer("PH SEO Parttimer");
    normalizedPdf.setCreator("PH SEO Parttimer");
    const finalPdf = await normalizedPdf.save();

    return new NextResponse(new Uint8Array(finalPdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error("dtr export failed", error);
    return NextResponse.json({ error: "Failed to export PDF" }, { status: 500 });
  }
}
