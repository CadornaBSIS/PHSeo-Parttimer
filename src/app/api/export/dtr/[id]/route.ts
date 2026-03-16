import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type DtrProfile = { full_name?: string | null };
type DtrProject = { name?: string | null };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  doc
    .fontSize(18)
    .fillColor("#111827")
    .text("ViteSeo Parttimer - DTR", { align: "left" });
  doc.fontSize(10).fillColor("#EF4444").text("Manager export • Internal");
  doc.moveDown();
  doc.fontSize(12).fillColor("#111827");
  doc.text(`Employee: ${employeeProfile?.full_name ?? "Employee"}`);
  doc.text(`Week: ${entry.week_start} - ${entry.week_end}`);
  doc.text(`Work date: ${entry.work_date}`);
  doc.text(`Project: ${entry.project_account ?? project?.name ?? "-"}`);
  doc.text(`Status: ${entry.status}`);
  doc.text(`Duration: ${entry.duration_minutes} mins`);
  doc.moveDown();
  doc.text(`Start: ${entry.start_time ?? "-"}`);
  doc.text(`End: ${entry.end_time ?? "-"}`);
  doc.moveDown();
  doc.text("Notes:");
  doc.text(entry.notes ?? "-", { width: 500 });
  doc.moveDown();
  doc.text("Image link:");
  doc.fillColor("#2563eb").text(entry.image_link ?? "-", { link: entry.image_link ?? undefined });

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
  });

  const pdfBody = new Uint8Array(pdfBuffer);

  return new NextResponse(pdfBody, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=dtr-${entry.id}.pdf`,
    },
  });
}
