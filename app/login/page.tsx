"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "../../lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function login() {
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setMessage(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="container" style={{maxWidth: 520, paddingTop: 80}}>
      <div className="card">
        <h1>Secure Question Paper Portal</h1>
        <p className="muted">Authorized personnel only.</p>

        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} />

        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />

        {message && <p className="error">{message}</p>}
        <button onClick={login}>Login</button>

        <hr />
        <p className="muted">
          Create test users from Supabase Authentication → Users, then assign their
          role in the profiles table.
        </p>
      </div>
    </main>
  );
}