"use client";

import { useState, type FormEvent } from "react";
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
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setCanResendConfirmation(false);
    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setCanResendConfirmation(error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message));
        return;
      }

      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp.find(item => item.status === "verified");
        if (factorError || !factor) {
          setMessage("No verified authenticator is available for this account.");
          return;
        }
        setFactorId(factor.id);
        setStage("mfa");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setMessage("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendConfirmation() {
    setMessage("");
    setIsResending(true);
    try {
      const { error } = await createSupabaseBrowser().auth.resend({ type: "signup", email });
      if (error) {
        setMessage(error.message);
        return;
      }
      setCanResendConfirmation(false);
      setMessage("Confirmation email sent. Check your inbox, then sign in.");
    } catch {
      setMessage("Could not resend the confirmation email. Check your connection and try again.");
    } finally {
      setIsResending(false);
    }
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
          <form onSubmit={login}>
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
            {message && <p className="error" role="alert">{message}</p>}
            {canResendConfirmation && <button className="text-action" type="button" disabled={isResending} onClick={resendConfirmation}>{isResending ? "Sending..." : "Resend confirmation email"}</button>}
            <button className="primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Continue"} <span aria-hidden="true">→</span></button>
            <p className="register-prompt">New to the portal? <Link href="/register">Create an account</Link></p>
          </form>
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