import { useAuth } from "../context/AuthContext.jsx";

export default function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Marginalia</span>
        <span className="org-name">{user?.organizationName}</span>
      </div>
      <div className="topbar-right">
        <span className="who">
          {user?.name} <span className={`badge badge-${user?.role}`}>{user?.role}</span>
        </span>
        <button className="btn btn-ghost" onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}
