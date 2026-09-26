"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"credentials" | "mfa">("credentials");
  const [message, setMessage] = useState("");

  async function login() {
    setMessage("");
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(error.message);

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
      const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find(item => item.status === "verified");
      if (factorError || !factor) return setMessage("No verified authenticator is available for this account.");
      setFactorId(factor.id);
      setStage("mfa");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function verifyMfa() {
    setMessage("");
    const { error } = await createSupabaseBrowser().auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (error) return setMessage(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <div className="login-aside">
        <div className="brand-mark">QP<span>/</span>SEC</div>
        <div>
          <p className="eyebrow">EXAMINATIONS · SECURE OPERATIONS</p>
          <h1>Protect the paper.<br />Preserve the exam.</h1>
          <p className="login-summary">A controlled workspace for encrypted question papers, verified access and traceable delivery.</p>
        </div>
        <div className="login-aside-foot">ACCESS IS RECORDED · MFA REQUIRED</div>
      </div>
      <section className="login-panel">
        <p className="eyebrow">AUTHORIZED PERSONNEL</p>
        <h2>{stage === "mfa" ? "Verify your identity" : "Sign in to the portal"}</h2>
        <p className="muted">{stage === "mfa" ? "Enter the current code from your authenticator app." : "Use your institution-issued account."}</p>

        {stage === "credentials" ? (
          <>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
            {message && <p className="error" role="alert">{message}</p>}
            <button className="primary-action" onClick={login}>Continue <span aria-hidden="true">→</span></button>
            <p className="register-prompt">New to the portal? <Link href="/register">Create an account</Link></p>
          </>
        ) : (
          <>
            <label htmlFor="mfa-code">6-digit authenticator code</label>
            <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} />
            {message && <p className="error" role="alert">{message}</p>}
            <button className="primary-action" onClick={verifyMfa}>Verify and continue <span aria-hidden="true">→</span></button>
            <button className="text-action" onClick={() => { setStage("credentials"); setCode(""); setMessage(""); }}>Back to sign in</button>
          </>
        )}

        <div className="login-note"><span className="status-dot" /> Encrypted storage · Role-restricted access · Audited activity</div>
      </section>
    </main>
  );
}