import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../../lib/supabase-server";
import { createSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { decryptPaper } from "../../../../../lib/crypto";
import { hasVerifiedMfa, mfaRequiredResponse } from "../../../../../lib/api-security";
import { createWatermarkId } from "../../../../../lib/watermark";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasVerifiedMfa(supabase))) return mfaRequiredResponse();

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["admin", "exam_officer", "exam_centre"].includes(profile.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data: paper, error } = await admin
    .from("papers")
    .select("id, title, subject, encrypted_content, iv, auth_tag, watermark_id")
    .eq("id", id).single();

  if (error || !paper) return NextResponse.json({ error: "Paper not found." }, { status: 404 });

  try {
    const content = decryptPaper(paper.encrypted_content, paper.iv, paper.auth_tag || "");
    const watermarkId = createWatermarkId();
    const { error: auditError } = await admin.from("audit_logs").insert({
      user_id: user.id,
      paper_id: paper.id,
      action: "PAPER_VIEWED",
      copy_watermark_id: watermarkId,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      user_agent: request.headers.get("user-agent") || null,
    });
    if (auditError) throw auditError;

    return NextResponse.json({
      title: paper.title,
      subject: paper.subject,
      content,
      watermark_id: watermarkId
    });
  } catch {
    return NextResponse.json({ error: "Decryption failed. Check encryption configuration." }, { status: 500 });
  }
}
