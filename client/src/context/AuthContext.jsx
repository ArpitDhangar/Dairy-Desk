import { createContext, useContext, useState, useCallback } from "react";
import API from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("dd_token") || null);
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("dd_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    localStorage.setItem("dd_token", res.data.token);
    localStorage.setItem("dd_user", JSON.stringify(res.data.user));
    setToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (firmName, email, password) => {
    const res = await API.post("/auth/register", { firmName, email, password });
    localStorage.setItem("dd_token", res.data.token);
    localStorage.setItem("dd_user", JSON.stringify(res.data.user));
    setToken(res.data.token);
    setUser(res.data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("dd_token");
    localStorage.removeItem("dd_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
