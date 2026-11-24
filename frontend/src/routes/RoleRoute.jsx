import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RoleRoute({ role }) {
  const { user } = useAuth();
  if (user?.role !== role) {
    return <Navigate to={user?.role === "professor" ? "/professor" : "/student"} replace />;
  }
  return <Outlet />;
}
