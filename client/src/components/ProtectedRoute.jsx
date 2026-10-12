import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export const homeFor = (user) => (user?.role === "admin" ? "/admin" : "/app");

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}
