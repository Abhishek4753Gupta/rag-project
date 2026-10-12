import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../api.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, [logout]);

  const accept = ({ token, user }) => {
    tokenStore.set(token);
    setUser(user);
    return user;
  };

  const login = async (email, password) => accept(await api("/auth/login", { method: "POST", body: { email, password } }));
  const registerOrganization = async (payload) =>
    accept(await api("/auth/register-organization", { method: "POST", body: payload }));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, registerOrganization }}>{children}</AuthContext.Provider>
  );
}
