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

type Props = {
  user: { id: string; email?: string };
  profile: { full_name: string; role: string };
};

export default function Dashboard({ user, profile }: Props) {
  const supabase = createSupabaseBrowser();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<any[]>([]);

  const canCreate = ["admin", "question_setter", "exam_officer"].includes(profile.role);
  const canAudit = ["admin", "exam_officer"].includes(profile.role);

  async function load() {
    const res = await fetch("/api/papers");
    const data = await res.json();
    if (res.ok) setPapers(data.papers || []);

    if (canAudit) {
      const logRes = await fetch("/api/audit");
      const logData = await logRes.json();
      if (logRes.ok) setLogs(logData.logs || []);
    }
  }

  useEffect(() => { load(); }, []);

  async function createPaper() {
    setMessage("");
    const res = await fetch("/api/papers", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ title, subject, content }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Could not create paper.");
    setMessage(`Paper created. Watermark: ${data.paper.watermark_id}`);
    setTitle(""); setSubject(""); setContent("");
    load();
  }

  async function decrypt(id: string) {
    setMessage("");
    const res = await fetch(`/api/papers/${id}/decrypt`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Could not decrypt.");
    setSelected(data);
    load();
  }

  async function securePrint(id: string) {
    const res = await fetch(`/api/papers/${id}/print`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "Print action failed.");

    const win = window.open("", "_blank");
    if (!win) return setMessage("Allow pop-ups to use secure print.");

    win.document.write(`
      <html><head><title>Secure Question Paper</title>
      <style>
      body{font-family:Arial;padding:40px;white-space:pre-wrap;line-height:1.6}
      .wm{margin-top:40px;border-top:1px solid #aaa;padding-top:10px;font-size:12px}
      </style></head><body>
      <h1>${escapeHtml(data.title)}</h1>
      <h3>${escapeHtml(data.subject)}</h3>
      <div>${escapeHtml(data.content)}</div>
      <div class="wm">SECURE COPY • Watermark: ${escapeHtml(data.watermark_id)} • Authorized print</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  async function logout() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

  return (
    <main className="container">
      <div className="row" style={{justifyContent:"space-between", marginBottom:18}}>
        <div>
          <h1>Secure Question Paper Portal</h1>
          <div className="muted">{profile.full_name} • {profile.role} • {user.email}</div>
        </div>
        <button className="secondary" onClick={logout}>Logout</button>
      </div>

      {message && <p className={message.startsWith("Paper created") ? "success" : "error"}>{message}</p>}

      {canCreate && (
        <section className="card" style={{marginBottom:18}}>
          <h2>Create Question Paper</h2>
          <p className="muted">Content is sent to the server and encrypted before database storage.</p>
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Data Structures Internal Examination" />
          <label>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Data Structures" />
          <label>Question Paper</label>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={"1. Explain stack and queue.\\n2. Write an algorithm for binary search.\\n3. Analyze merge sort."} />
          <button style={{marginTop:12}} onClick={createPaper}>Create & Encrypt Paper</button>
        </section>
      )}

      <div className="grid grid2">
        <section className="card">
          <h2>Stored Papers</h2>
          {papers.length === 0 && <p className="muted">No papers available.</p>}
          {papers.map(p => (
            <div key={p.id} style={{borderTop:"1px solid #e4e9ed", padding:"14px 0"}}>
              <strong>{p.title}</strong>
              <div className="muted">{p.subject}</div>
              <div className="row" style={{marginTop:8}}>
                <span className="badge">Encrypted</span>
                <span className="badge">{p.watermark_id}</span>
              </div>
              <div className="row" style={{marginTop:10}}>
                <button onClick={() => decrypt(p.id)}>Decrypt / View</button>
                {profile.role === "exam_centre" && (
                  <button className="secondary" onClick={() => securePrint(p.id)}>Secure Print</button>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <h2>Paper Viewer</h2>
          {!selected && <p className="muted">Select a paper to view it.</p>}
          {selected && (
            <>
              <h3>{selected.title}</h3>
              <p className="muted">{selected.subject}</p>
              <div className="paper">{selected.content}</div>
              <p className="muted">Watermark: {selected.watermark_id}</p>
            </>
          )}
        </section>
      </div>

      {canAudit && (
        <section className="card" style={{marginTop:18}}>
          <h2>Recent Audit Logs</h2>
          {logs.length === 0 && <p className="muted">No audit events.</p>}
          {logs.map(log => (
            <div key={log.id} style={{padding:"10px 0", borderTop:"1px solid #e4e9ed"}}>
              <strong>{log.action}</strong> • {new Date(log.created_at).toLocaleString()}
              <div className="muted">User: {log.user_id} {log.watermark_id ? `• ${log.watermark_id}` : ""}</div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]!));
}