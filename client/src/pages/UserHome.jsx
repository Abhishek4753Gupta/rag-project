import { useEffect, useState } from "react";
import { api } from "../api.js";
import Topbar from "../components/Topbar.jsx";
import Chat from "../components/Chat.jsx";

export default function UserHome() {
  const [docs, setDocs] = useState(null);
  useEffect(() => {
    api("/chat/documents").then((d) => setDocs(d.documents)).catch(() => setDocs([]));
  }, []);

  return (
    <div className="page">
      <Topbar />
      <div className="user-layout">
        <Chat />
        <aside className="card kb">
          <h3>What I can answer from</h3>
          {docs === null ? <p className="muted">Loading…</p> : docs.length === 0 ? (
            <p className="muted">No documents yet. Ask your admin to upload some.</p>
          ) : (
            <ul className="kb-list">
              {docs.map((d) => (<li key={d._id}><span>{d.originalName}</span><small>{d.pageCount} {d.pageCount === 1 ? "page" : "pages"}</small></li>))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
