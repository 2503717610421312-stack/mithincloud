import { NextResponse } from "next/server";
import { createSupabaseServer } from "../../../lib/supabase-server";
import { createSupabaseAdmin } from "../../../lib/supabase-admin";

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["admin","exam_officer"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("audit_logs")
    .select("id,user_id,paper_id,action,created_at,papers(watermark_id)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const logs = (data || []).map((item: any) => ({
    ...item,
    watermark_id: item.papers?.watermark_id || null
  }));

  return NextResponse.json({ logs });
}