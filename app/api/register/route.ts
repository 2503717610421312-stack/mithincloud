import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../lib/supabase-admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (
    !fullName || fullName.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    !password || password.length > 256
  ) {
    return NextResponse.json({ error: "Enter a valid name, email address, and password." }, { status: 400 });
  }

  try {
    const { error } = await createSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Registration service is unavailable. Check the server configuration." }, { status: 500 });
  }
}