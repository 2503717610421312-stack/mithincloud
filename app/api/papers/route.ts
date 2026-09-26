import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase-server";
import { createSupabaseAdmin } from "../../../lib/supabase-admin";
import { encryptPaper } from "../../../lib/crypto";
import { createWatermarkId } from "../../../lib/watermark";
import { hasVerifiedMfa, mfaRequiredResponse } from "../../../lib/api-security";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasVerifiedMfa(supabase))) return mfaRequiredResponse();

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["admin", "question_setter", "exam_officer", "exam_centre"].includes(profile.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("papers")
    .select("id,title,subject,watermark_id,created_at,created_by")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ papers: data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await hasVerifiedMfa(supabase))) return mfaRequiredResponse();

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["admin","question_setter","exam_officer"].includes(profile.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body.title || "").trim();
  const subject = String(body.subject || "").trim();
  const content = String(body.content || "").trim();

  if (!title || !subject || !content) {
    return NextResponse.json({ error: "Title, subject and content are required." }, { status: 400 });
  }
  if (content.length > 50000) {
    return NextResponse.json({ error: "Question paper is too large." }, { status: 400 });
  }

  const encrypted = encryptPaper(content);
  const watermarkId = createWatermarkId();
  const admin = createSupabaseAdmin();

  const { data: paper, error } = await admin.from("papers").insert({
    title, subject,
    encrypted_content: encrypted.encryptedContent,
    iv: encrypted.iv,
    auth_tag: encrypted.authTag,
    watermark_id: watermarkId,
    created_by: user.id
  }).select("id,title,subject,watermark_id,created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    user_id: user.id,
    paper_id: paper.id,
    action: "PAPER_CREATED"
  });

  return NextResponse.json({ paper }, { status: 201 });
}