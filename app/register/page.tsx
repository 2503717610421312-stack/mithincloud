"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "../../lib/supabase-browser";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    setIsSubmitting(true);
    const { data, error } = await createSupabaseBrowser().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setIsSubmitting(false);

    if (error) {
      setIsError(true);
      setMessage(error.message);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setIsError(true);
    setMessage("No account session was created. Turn off email confirmation in Supabase Auth settings, then try again.");
  }

  return (
    <main className="login-shell">
      <div className="login-aside">
        <div className="brand-mark">QP<span>/</span>SEC</div>
        <div>
          <p className="eyebrow">EXAMINATIONS · SECURE OPERATIONS</p>
          <h1>Access begins<br />with verification.</h1>
          <p className="login-summary">Create a basic account. An administrator reviews and assigns access before papers are available.</p>
        </div>
        <div className="login-aside-foot">NEW ACCOUNTS REQUIRE APPROVAL</div>
      </div>
      <section className="login-panel register-panel">
        <p className="eyebrow">REQUEST PORTAL ACCESS</p>
        <h2>Create your account</h2>
        <p className="muted">Account access is enabled after administrator approval.</p>

        <form onSubmit={register}>
          <label htmlFor="full-name">Full name</label>
          <input id="full-name" autoComplete="name" maxLength={120} required value={fullName} onChange={event => setFullName(event.target.value)} />
          <label htmlFor="register-email">Email address</label>
          <input id="register-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
          <label htmlFor="register-password">Password</label>
          <input id="register-password" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} />
          {message && <p className={isError ? "error" : "success register-message"} role={isError ? "alert" : "status"}>{message}</p>}
          <button className="primary-action" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}<span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="register-prompt">Already registered? <Link href="/login">Sign in</Link></p>
        <div className="login-note"><span className="status-dot" /> Admin approval · MFA required</div>
      </section>
    </main>
  );
}