import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../../lib/supabase-server";
import { createSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { decryptPaper } from "../../../../../lib/crypto";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["admin","question_setter","exam_officer","exam_centre"].includes(profile.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data: paper, error } = await admin
    .from("papers")
    .select("id,title,subject,encrypted_content,iv,watermark_id")
    .eq("id", id).single();

  if (error || !paper) return NextResponse.json({ error: "Paper not found." }, { status: 404 });

  try {
    const content = decryptPaper(paper.encrypted_content, paper.iv, paper.auth_tag || "");
    await admin.from("audit_logs").insert({
      user_id: user.id,
      paper_id: paper.id,
      action: "PAPER_DECRYPTED"
    });

    return NextResponse.json({
      title: paper.title,
      subject: paper.subject,
      content,
      watermark_id: paper.watermark_id
    });
  } catch {
    return NextResponse.json({ error: "Decryption failed. Check encryption configuration." }, { status: 500 });
  }
}