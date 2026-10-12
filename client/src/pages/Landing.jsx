import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homeFor } from "../components/ProtectedRoute.jsx";

export default function Landing() {
  const { registerOrganization } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organizationName: "", adminName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await registerOrganization(form);
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="landing">
      <nav className="landing-nav">
        <div className="brand"><span className="brand-mark" aria-hidden="true" /><span className="brand-name">Marginalia</span></div>
        <Link to="/login" className="btn btn-ghost">Sign in</Link>
      </nav>

      <div className="landing-grid">
        <section className="hero">
          <h1>Your documents, answered with the page number.</h1>
          <p className="lede">
            Upload your policies, handbooks and manuals once. Everyone in your organization can then ask questions in plain
            language and get answers that point back to the exact page.
          </p>

          <figure className="sample" aria-label="Example answer">
            <figcaption>Example question: how long is parental leave?</figcaption>
            <p>
              Eligible employees receive 16 weeks of paid parental leave <span className="cite static">1</span>, which can be taken
              in two blocks within the first year <span className="cite static">2</span>.
            </p>
            <div className="sources">
              <span className="source"><span className="cite static">1</span><span className="source-name">HR-Handbook.pdf</span><span className="source-page">p. 14</span></span>
              <span className="source"><span className="cite static">2</span><span className="source-name">Leave-Policy.docx</span><span className="source-page">p. 3</span></span>
            </div>
          </figure>
          <p className="fine">If the documents don't contain the answer, Marginalia says so instead of guessing.</p>
        </section>

        <section className="card register" aria-labelledby="reg-title">
          <h2 id="reg-title">Register your organization</h2>
          <p className="muted">You'll become the admin. You can upload documents and add your team afterwards.</p>
          <form onSubmit={submit} className="form">
            <label>Organization name<input value={form.organizationName} onChange={set("organizationName")} required minLength={2} autoComplete="organization" /></label>
            <label>Your name<input value={form.adminName} onChange={set("adminName")} required minLength={2} autoComplete="name" /></label>
            <label>Work email<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></label>
            <label>Password<input type="password" value={form.password} onChange={set("password")} required minLength={8} autoComplete="new-password" /><small>At least 8 characters</small></label>
            {error && <div className="alert" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Creating…" : "Create organization"}</button>
          </form>
          <p className="muted small">Already registered? <Link to="/login">Sign in</Link>. Team members get their accounts from their admin.</p>
        </section>
      </div>
    </main>
  );
}
