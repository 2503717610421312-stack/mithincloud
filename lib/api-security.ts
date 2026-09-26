import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasVerifiedMfa(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return !error && data.currentLevel === "aal2";
}

export function mfaRequiredResponse() {
  return NextResponse.json(
    {
      code: "MFA_REQUIRED",
      error: "Verify an authenticator app code before accessing examination papers.",
    },
    { status: 403 }
  );
}