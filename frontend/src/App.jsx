import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { useAuth } from "./context/AuthContext";
import { LoadingState } from "./components/ui/LoadingState";
import { Login } from "./pages/Login";
import { NotFound } from "./pages/NotFound";
import { ProfessorHome } from "./pages/ProfessorHome";
import { Register } from "./pages/Register";
import { StudentHome } from "./pages/StudentHome";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleRoute } from "./routes/RoleRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute role="student" />}>
          <Route path="/student" element={<AppShell />}>
            <Route index element={<StudentHome />} />
            <Route path="*" element={<StudentHome />} />
          </Route>
        </Route>

        <Route element={<RoleRoute role="professor" />}>
          <Route path="/professor" element={<AppShell />}>
            <Route index element={<ProfessorHome />} />
            <Route path="*" element={<ProfessorHome />} />
          </Route>
        </Route>

        <Route path="/" element={<RoleHomeRedirect />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function RoleHomeRedirect() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return <LoadingState fullScreen label="Opening workspace" />;
  }
  if (user?.role === "professor") {
    return <Navigate to="/professor" replace />;
  }
  if (user?.role === "student") {
    return <Navigate to="/student" replace />;
  }
  return <Navigate to="/login" replace />;
}
