import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../../../lib/supabase-server";
import { createSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { decryptPaper } from "../../../../../lib/crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["admin","exam_centre"].includes(profile.role)) {
    return NextResponse.json({ error: "Only an authorized exam centre can print." }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data: paper, error } = await admin
    .from("papers")
    .select("id,title,subject,encrypted_content,iv,watermark_id,auth_tag")
    .eq("id", id).single();

  if (error || !paper) return NextResponse.json({ error: "Paper not found." }, { status: 404 });

  try {
    const content = decryptPaper(paper.encrypted_content, paper.iv, paper.auth_tag || "");

    const forwarded = request.headers.get("x-forwarded-for");
    const userAgent = request.headers.get("user-agent");

    await admin.from("audit_logs").insert({
      user_id: user.id,
      paper_id: paper.id,
      action: "PAPER_PRINTED",
      ip_address: forwarded?.split(",")[0]?.trim() || null,
      user_agent: userAgent || null
    });

    return NextResponse.json({
      title: paper.title,
      subject: paper.subject,
      content,
      watermark_id: paper.watermark_id
    });
  } catch {
    return NextResponse.json({ error: "Decryption failed." }, { status: 500 });
  }
}