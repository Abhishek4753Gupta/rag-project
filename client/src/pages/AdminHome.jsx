import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import Topbar from "../components/Topbar.jsx";
import Chat from "../components/Chat.jsx";

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/* ------------------------------------------------------------ Documents */
function Documents() {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => api("/admin/documents").then((d) => setDocs(d.documents)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  // Poll while anything is still being embedded
  useEffect(() => {
    if (!docs.some((d) => d.status === "processing")) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [docs, load]);

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api("/admin/documents", { method: "POST", form });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(d) {
    if (!confirm(`Delete "${d.originalName}"? Its content will no longer be used in answers.`)) return;
    try { await api(`/admin/documents/${d._id}`, { method: "DELETE" }); await load(); } catch (err) { setError(err.message); }
  }

  return (
    <div className="stack">
      <div className="card upload">
        <div>
          <h3>Add a document</h3>
          <p className="muted">PDF, Word (.docx), Markdown or text. Up to 15 MB. Scanned PDFs need to be text-searchable first.</p>
        </div>
        <label className={`btn btn-primary ${uploading ? "is-disabled" : ""}`}>
          {uploading ? "Uploading…" : "Choose file"}
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" onChange={upload} disabled={uploading} hidden />
        </label>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="card">
        <h3>Knowledge base <span className="count">{docs.length}</span></h3>
        {docs.length === 0 ? (
          <p className="muted empty">Nothing here yet. Upload your first document to start answering questions.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Document</th><th>Status</th><th>Pages</th><th>Chunks</th><th>Added</th><th /></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d._id}>
                  <td><strong>{d.originalName}</strong><small>{fmtSize(d.size)}</small></td>
                  <td>
                    <span className={`status status-${d.status}`}>{d.status === "processing" ? "Indexing…" : d.status === "ready" ? "Ready" : "Failed"}</span>
                    {d.error && <small className="err-text">{d.error}</small>}
                  </td>
                  <td>{d.pageCount || "–"}</td>
                  <td>{d.chunkCount || "–"}</td>
                  <td>{fmtDate(d.createdAt)}</td>
                  <td className="right"><button className="btn btn-danger-ghost" onClick={() => remove(d)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Team */
function Team() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => api("/admin/users").then((d) => setUsers(d.users)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/admin/users", { method: "POST", body: form });
      setForm({ name: "", email: "", password: "", role: "user" });
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(u) {
    if (!confirm(`Remove ${u.name}? They will lose access immediately.`)) return;
    try { await api(`/admin/users/${u.id}`, { method: "DELETE" }); await load(); } catch (err) { setError(err.message); }
  }

  return (
    <div className="stack">
      <form className="card form form-row" onSubmit={add}>
        <h3>Add a team member</h3>
        <div className="grid-4">
          <label>Name<input value={form.name} onChange={set("name")} required minLength={2} /></label>
          <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
          <label>Temporary password<input type="text" value={form.password} onChange={set("password")} required minLength={8} /></label>
          <label>Role<select value={form.role} onChange={set("role")}><option value="user">User (can ask questions)</option><option value="admin">Admin (can also upload)</option></select></label>
        </div>
        {error && <div className="alert" role="alert">{error}</div>}
        <div><button className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add member"}</button></div>
      </form>
      <div className="card">
        <h3>Members <span className="count">{users.length}</span></h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.name}</strong></td><td>{u.email}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                <td className="right"><button className="btn btn-danger-ghost" onClick={() => remove(u)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Activity */
function Activity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/admin/activity").then(setData).catch((e) => setError(e.message)); }, []);
  if (error) return <div className="alert">{error}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div className="stack">
      <div className="stats">
        <div className="card stat"><strong>{data.stats.total}</strong><span>questions asked</span></div>
        <div className="card stat"><strong>{data.stats.unanswered}</strong><span>couldn't be answered from the documents</span></div>
      </div>
      <div className="card">
        <h3>Recent questions</h3>
        {data.logs.length === 0 ? <p className="muted empty">No questions yet.</p> : (
          <table className="table">
            <thead><tr><th>Question</th><th>Asked by</th><th>Result</th><th>When</th></tr></thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.question}</td><td>{l.user}</td>
                  <td><span className={`status ${l.answered ? "status-ready" : "status-failed"}`}>{l.answered ? "Answered" : "Not found"}</span></td>
                  <td>{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">Questions marked "Not found" show what's missing from your documents.</p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Page */
const TABS = [
  ["documents", "Documents"],
  ["team", "Team"],
  ["assistant", "Ask a question"],
  ["activity", "Activity"],
];

export default function AdminHome() {
  const [tab, setTab] = useState("documents");
  return (
    <div className="page">
      <Topbar />
      <div className="admin-wrap">
        <div className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? "is-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        {tab === "documents" && <Documents />}
        {tab === "team" && <Team />}
        {tab === "assistant" && <div className="admin-chat"><Chat /></div>}
        {tab === "activity" && <Activity />}
      </div>
    </div>
  );
}
