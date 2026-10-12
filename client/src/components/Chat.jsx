import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

/** Tiny safe renderer: **bold**, "- " bullets, and [n] citation chips. No dangerouslySetInnerHTML. */
function Inline({ text, sources, onCite }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    const m = p.match(/^\[(\d+)\]$/);
    if (m) {
      const n = Number(m[1]);
      return sources.some((s) => s.n === n) ? (
        <button key={i} className="cite" onClick={() => onCite(n)} aria-label={`Show source ${n}`}>{n}</button>
      ) : null;
    }
    return <span key={i}>{p}</span>;
  });
}

function Answer({ msg }) {
  const [open, setOpen] = useState(null);
  const lines = msg.content.split("\n").filter((l) => l.trim());
  return (
    <div className="answer">
      {lines.map((line, i) =>
        /^\s*[-*•]\s+/.test(line) ? (
          <p key={i} className="bullet">
            <Inline text={line.replace(/^\s*[-*•]\s+/, "")} sources={msg.sources} onCite={setOpen} />
          </p>
        ) : (
          <p key={i}><Inline text={line} sources={msg.sources} onCite={setOpen} /></p>
        )
      )}
      {msg.sources.length > 0 && (
        <div className="sources">
          {msg.sources.map((s) => (
            <button key={s.n} className={`source ${open === s.n ? "is-open" : ""}`} onClick={() => setOpen(open === s.n ? null : s.n)}>
              <span className="cite static">{s.n}</span>
              <span className="source-name">{s.source}</span>
              <span className="source-page">p. {s.page}</span>
            </button>
          ))}
          {open && <blockquote className="snippet">“{msg.sources.find((s) => s.n === open)?.snippet}…”</blockquote>}
        </div>
      )}
    </div>
  );
}

const EXAMPLES = ["What is our leave policy?", "Summarize the onboarding checklist", "Who approves travel expenses?"];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, busy]);

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setError("");
    setInput("");
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setBusy(true);
    try {
      const res = await api("/chat", { method: "POST", body: { question, history } });
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat">
      <div className="chat-scroll">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h2>Ask about anything in your organization's documents.</h2>
            <p>Every answer comes with the pages it was taken from. If the documents don't say, you'll be told so.</p>
            <div className="chips">
              {EXAMPLES.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg msg-user">{m.content}</div>
          ) : (
            <div key={i} className="msg msg-ai"><Answer msg={m} /></div>
          )
        )}
        {busy && <div className="msg msg-ai typing">Reading the documents…</div>}
        {error && <div className="alert" role="alert">{error}</div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          maxLength={1000}
          aria-label="Your question"
        />
        <button className="btn btn-primary" disabled={busy || input.trim().length < 2}>Ask</button>
      </form>
    </section>
  );
}
