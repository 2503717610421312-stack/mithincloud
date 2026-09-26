"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "../lib/supabase-browser";

type Paper = {
  id: string;
  title: string;
  subject: string;
  watermark_id: string;
  created_at: string;
  created_by: string;
};

type PaperCopy = {
  title: string;
  subject: string;
  content: string;
  watermark_id: string;
};

type AuditLog = {
  id: number;
  user_id: string;
  paper_id: string | null;
  action: string;
  watermark_id: string | null;
  created_at: string;
};

type Enrollment = {
  id: string;
  qrCode: string;
  secret: string;
};

type Props = {
  user: { id: string; email?: string };
  profile: { full_name: string; role: string };
};

export default function Dashboard({ user, profile }: Props) {
  const supabase = createSupabaseBrowser();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selected, setSelected] = useState<PaperCopy | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [mfaStage, setMfaStage] = useState<"loading" | "verified" | "enroll" | "verify">("loading");
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");

  const canCreate = ["admin", "question_setter", "exam_officer"].includes(profile.role);
  const canView = ["admin", "exam_officer", "exam_centre"].includes(profile.role);
  const canPrint = ["admin", "exam_centre"].includes(profile.role);
  const canAudit = ["admin", "exam_officer"].includes(profile.role);

  async function refreshMfa() {
    const [{ data: assurance }, { data: factors }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const verifiedFactor = factors?.totp.find(factor => factor.status === "verified");

    if (assurance?.currentLevel === "aal2") {
      setMfaStage("verified");
      setFactorId(verifiedFactor?.id || "");
      return true;
    }

    if (verifiedFactor) {
      setFactorId(verifiedFactor.id);
      setMfaStage("verify");
    } else {
      setMfaStage("enroll");
    }
    return false;
  }

  async function load() {
    const res = await fetch("/api/papers");
    const data = await res.json();
    if (res.ok) setPapers(data.papers || []);
    if (data.code === "MFA_REQUIRED") {
      await refreshMfa();
      return;
    }

    if (canAudit) {
      const logRes = await fetch("/api/audit");
      const logData = await logRes.json();
      if (logRes.ok) setLogs(logData.logs || []);
    }
  }

  useEffect(() => {
    void (async () => {
      if (await refreshMfa()) await load();
    })();
  }, []);

  async function beginMfaSetup() {
    setMfaMessage("");
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Question paper portal",
    });
    if (error) return setMfaMessage(error.message);
    setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setFactorId(data.id);
  }

  async function verifyMfa() {
    setMfaMessage("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: mfaCode.trim(),
    });
    if (error) return setMfaMessage(error.message);
    setEnrollment(null);
    setMfaCode("");
    setMfaStage("verified");
    setMessage("Authenticator verified. Secure paper access is enabled.");
    await load();
  }

  async function createPaper() {
    setMessage("");
    const res = await fetch("/api/papers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subject, content }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "MFA_REQUIRED") await refreshMfa();
      return setMessage(data.error || "Could not create paper.");
    }
    setMessage(`Paper sealed. Reference watermark: ${data.paper.watermark_id}`);
    setTitle("");
    setSubject("");
    setContent("");
    await load();
  }

  async function decrypt(id: string) {
    setMessage("");
    const res = await fetch(`/api/papers/${id}/decrypt`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "MFA_REQUIRED") await refreshMfa();
      return setMessage(data.error || "Could not open paper.");
    }
    setSelected(data);
    await load();
  }

  async function securePrint(id: string) {
    const win = window.open("", "_blank");
    if (!win) return setMessage("Allow pop-ups to use the print authorization demo.");
    win.document.write("<title>Preparing secure print</title><p>Authorizing print...</p>");

    const res = await fetch(`/api/papers/${id}/print`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      win.close();
      if (data.code === "MFA_REQUIRED") await refreshMfa();
      return setMessage(data.error || "Print authorization failed.");
    }

    win.document.open();
    win.document.write(`
      <!doctype html><html><head><title>Secure Question Paper</title>
      <style>
      body{font-family:Georgia,serif;padding:48px;white-space:pre-wrap;line-height:1.65;color:#192522}
      h1{font-family:Arial,sans-serif}h3{font-family:Arial,sans-serif;color:#53635e}
      .wm{margin-top:42px;border-top:1px solid #9eaaa5;padding-top:12px;font:12px Arial,sans-serif;color:#53635e}
      @media print{body{padding:18mm}}
      </style></head><body>
      <h1>${escapeHtml(data.title)}</h1>
      <h3>${escapeHtml(data.subject)}</h3>
      <div>${escapeHtml(data.content)}</div>
      <div class="wm">CONTROLLED COPY · ${escapeHtml(data.watermark_id)} · Issued to ${escapeHtml(user.email || user.id)}</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    setMessage(`Print authorized. Copy watermark: ${data.watermark_id}`);
    await load();
  }

  async function logout() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">QP<span>/</span>SEC</div>
        <div className="sidebar-rule" />
        <p className="sidebar-label">WORKSPACE</p>
        <div className="nav-item active"><span className="nav-glyph">▦</span> Security console</div>
        <p className="sidebar-label sidebar-bottom-label">CONTROL PLANE</p>
        <div className="sidebar-control"><span className="status-dot" /> AES-256-GCM</div>
        <div className="sidebar-control"><span className="status-dot" /> MFA gated</div>
        <div className="sidebar-control"><span className="status-dot" /> Audit trail</div>
        <div className="sidebar-footer">EXAM SECURITY<br />DEMONSTRATION SYSTEM</div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="crumb">SECURE OPERATIONS <span>/</span> OVERVIEW</div>
          <div className="account-area">
            <div className="account-identity"><strong>{profile.full_name}</strong><span>{profile.role.replaceAll("_", " ")}</span></div>
            <button className="quiet-button" onClick={logout}>Sign out</button>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">QUESTION PAPER LIFECYCLE</p>
              <h1>Security console</h1>
              <p className="muted">Create, protect and account for controlled examination material.</p>
            </div>
            <div className={`assurance-pill ${mfaStage === "verified" ? "assured" : "pending"}`}>
              <span className="status-dot" /> {mfaStage === "verified" ? "MFA VERIFIED" : mfaStage === "loading" ? "CHECKING MFA" : "MFA SETUP REQUIRED"}
            </div>
          </section>

          <section className="process-strip" aria-label="Paper security workflow">
            <div className="process-step"><span>01</span><strong>Prepare</strong><small>Authorized setter</small></div>
            <div className="process-connector" />
            <div className="process-step"><span>02</span><strong>Encrypt</strong><small>AES-256-GCM</small></div>
            <div className="process-connector" />
            <div className="process-step"><span>03</span><strong>Release</strong><small>MFA + role check</small></div>
            <div className="process-connector" />
            <div className="process-step"><span>04</span><strong>Trace</strong><small>Copy watermark + log</small></div>
          </section>

          {mfaStage !== "verified" && (
            <section className="mfa-panel">
              <div className="mfa-panel-copy">
                <p className="eyebrow">ACCESS ASSURANCE · REQUIRED</p>
                <h2>{mfaStage === "verify" ? "Verify your authenticator" : "Set up multi-factor authentication"}</h2>
                <p className="muted">Paper records and sensitive actions stay locked until this account reaches MFA assurance level 2.</p>
                {mfaStage === "enroll" && !enrollment && <button onClick={beginMfaSetup}>Set up authenticator</button>}
                {mfaMessage && <p className="error" role="alert">{mfaMessage}</p>}
              </div>
              {enrollment && (
                <div className="mfa-enrollment">
                  <img className="mfa-qr" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qrCode)}`} alt="Scan with an authenticator app" />
                  <div>
                    <label htmlFor="mfa-setup-code">Authenticator code</label>
                    <input id="mfa-setup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, ""))} />
                    <p className="secret-hint">Manual setup key: <code>{enrollment.secret}</code></p>
                    <button className="small-action" onClick={verifyMfa}>Verify authenticator</button>
                  </div>
                </div>
              )}
              {mfaStage === "verify" && (
                <div className="mfa-enrollment mfa-verify">
                  <div>
                    <label htmlFor="mfa-dashboard-code">6-digit authenticator code</label>
                    <input id="mfa-dashboard-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, ""))} />
                    <button className="small-action" onClick={verifyMfa}>Verify and unlock</button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="control-band" aria-label="Active security controls">
            <div><span className="control-index">01 / CONFIDENTIALITY</span><strong>AES-256-GCM at rest</strong><small>Keys remain server-side</small></div>
            <div><span className="control-index">02 / ACCESS</span><strong>Role + MFA assurance</strong><small>Checked by protected API routes</small></div>
            <div><span className="control-index">03 / TRACEABILITY</span><strong>Unique issued-copy ID</strong><small>Matched to user and audit event</small></div>
          </section>

          {message && <p className={message.startsWith("Paper sealed") || message.startsWith("Authenticator verified") || message.startsWith("Print authorized") ? "success notice" : "error notice"} role="status">{message}</p>}

          <div className="work-grid">
            {canCreate && (
              <section className="work-section create-section">
                <div className="section-heading"><div><p className="eyebrow">CONTROLLED INTAKE</p><h2>Create a paper</h2></div><span className="section-tag">SETTER</span></div>
                <label htmlFor="paper-title">Paper title</label>
                <input id="paper-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="End-term examination" disabled={mfaStage !== "verified"} />
                <label htmlFor="paper-subject">Subject</label>
                <input id="paper-subject" value={subject} onChange={event => setSubject(event.target.value)} placeholder="Computer science" disabled={mfaStage !== "verified"} />
                <label htmlFor="paper-content">Question paper content</label>
                <textarea id="paper-content" value={content} onChange={event => setContent(event.target.value)} placeholder={"1. Explain the core concept.\n2. Solve the following problem.\n3. Analyze the time complexity."} disabled={mfaStage !== "verified"} />
                <div className="form-footer"><span>Encrypted before database storage</span><button onClick={createPaper} disabled={mfaStage !== "verified" || !title.trim() || !subject.trim() || !content.trim()}>Encrypt & seal <span aria-hidden="true">→</span></button></div>
              </section>
            )}

            <section className="work-section paper-section">
              <div className="section-heading"><div><p className="eyebrow">ENCRYPTED REGISTER</p><h2>Stored papers</h2></div><span className="count-tag">{papers.length.toString().padStart(2, "0")}</span></div>
              {mfaStage !== "verified" ? <p className="empty-state">Complete MFA verification to access the paper register.</p> : papers.length === 0 ? <p className="empty-state">No sealed papers yet.</p> : (
                <div className="paper-list">
                  {papers.map(paper => (
                    <article className="paper-row" key={paper.id}>
                      <div className="paper-row-main"><span className="encrypted-mark">LOCKED</span><div><strong>{paper.title}</strong><p>{paper.subject} <span>·</span> {new Date(paper.created_at).toLocaleDateString()}</p></div></div>
                      <div className="paper-row-actions">
                        {canView && <button className="row-action" onClick={() => decrypt(paper.id)}>Authorize view</button>}
                        {canPrint && <button className="row-action print-action" onClick={() => securePrint(paper.id)}>Print</button>}
                        {!canView && <span className="role-lock">VIEW RESTRICTED</span>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="lower-grid">
            <section className="work-section viewer-section">
              <div className="section-heading"><div><p className="eyebrow">AUTHORIZED DELIVERY</p><h2>Paper viewer</h2></div></div>
              {!selected ? <p className="empty-state">Authorized paper content appears here after a view action.</p> : (
                <div className="viewer-paper">
                  <div className="viewer-copy-mark">CONTROLLED COPY · {selected.watermark_id}</div>
                  <h3>{selected.title}</h3><p className="viewer-subject">{selected.subject}</p>
                  <div className="paper-content">{selected.content}</div>
                  <div className="viewer-watermark">Issued copy ID <strong>{selected.watermark_id}</strong></div>
                </div>
              )}
            </section>

            {canAudit && (
              <section className="work-section audit-section">
                <div className="section-heading"><div><p className="eyebrow">ACCOUNTABILITY</p><h2>Recent activity</h2></div><span className="live-tag"><span className="status-dot" /> LIVE LOG</span></div>
                {logs.length === 0 ? <p className="empty-state">No recorded activity yet.</p> : (
                  <div className="audit-list">
                    {logs.map(log => (
                      <article className="audit-row" key={log.id}>
                        <div className="audit-marker" />
                        <div className="audit-copy"><strong>{log.action.replaceAll("_", " ")}</strong><p>{new Date(log.created_at).toLocaleString()}</p><small>User {log.user_id}{log.watermark_id ? ` · Copy ${log.watermark_id}` : ""}</small></div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <footer className="security-disclaimer"><strong>Operational boundary</strong><span>Browser print authorization is logged, but cannot restrict local screenshots, cameras, USB devices or printer queues. HSM, managed print, DLP and physical monitoring require institution-controlled infrastructure.</span></footer>
        </div>
      </main>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]!));
}