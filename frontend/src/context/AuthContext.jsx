import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [authError, setAuthError] = useState(null);

  async function refreshUser() {
    setStatus("loading");
    setAuthError(null);
    try {
      const response = await getCurrentUser();
      setUser(response.data.user);
      setStatus("authenticated");
      return response.data.user;
    } catch (error) {
      setUser(null);
      setStatus("unauthenticated");
      if (error?.response?.status !== 401) {
        setAuthError("Unable to verify your session. Please try signing in.");
      }
      return null;
    }
  }

  useEffect(() => {
    refreshUser();
  }, []);

  async function login(credentials) {
    const response = await loginUser(credentials);
    setUser(response.data.user);
    setStatus("authenticated");
    setAuthError(null);
    return response.data.user;
  }

  async function register(payload) {
    const response = await registerUser(payload);
    setUser(response.data.user);
    setStatus("authenticated");
    setAuthError(null);
    return response.data.user;
  }

  async function logout() {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
      setAuthError(null);
    }
  }

  const value = useMemo(
    () => ({
      user,
      status,
      authError,
      refreshUser,
      login,
      register,
      logout,
    }),
    [user, status, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
