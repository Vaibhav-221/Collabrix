import { GraduationCap, LogOut, UserRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";

export function AppShell() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const roleRoot = user?.role === "professor" ? "/professor" : "/student";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      window.location.assign("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-collabrix-background text-collabrix-text">
      <header className="sticky top-0 z-30 border-b border-collabrix-border bg-collabrix-background/95 backdrop-blur md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Brand compact />
          <Button variant="secondary" className="px-3" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {loggingOut ? "Signing out" : "Logout"}
          </Button>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-collabrix-border bg-collabrix-surface md:flex">
        <div className="border-b border-collabrix-border px-6 py-5">
          <Brand />
        </div>
        <nav className="flex-1 px-3 py-5" aria-label="Main navigation">
          <NavLink
            to={roleRoot}
            end
            className={({ isActive }) =>
              `flex rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-collabrix-accent/40 bg-collabrix-accent/10 text-white"
                  : "border-transparent text-collabrix-muted hover:border-collabrix-border hover:bg-collabrix-elevated hover:text-collabrix-text"
              }`
            }
          >
            Overview
          </NavLink>
        </nav>
        <div className="border-t border-collabrix-border p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-collabrix-border bg-collabrix-elevated px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-collabrix-border bg-collabrix-background">
              <UserRound className="h-4 w-4 text-collabrix-muted" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-collabrix-text">{user?.fullName}</p>
              <p className="truncate text-xs capitalize text-collabrix-muted">{user?.role}</p>
            </div>
          </div>
          <Button variant="danger" className="w-full" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {loggingOut ? "Signing out" : "Logout"}
          </Button>
        </div>
      </aside>

      <main className="min-h-screen px-4 py-6 md:ml-64 md:px-8 md:py-8">
        <Outlet />
      </main>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-collabrix-accent/30 bg-collabrix-accent/10">
        <GraduationCap className="h-5 w-5 text-violet-300" />
      </div>
      {!compact ? (
        <div>
          <p className="text-sm font-bold tracking-tight text-collabrix-text">Collabrix</p>
          <p className="text-[11px] text-collabrix-muted">Student Groups & Assignment Management</p>
        </div>
      ) : (
        <p className="text-sm font-bold text-collabrix-text">Collabrix</p>
      )}
    </div>
  );
}
