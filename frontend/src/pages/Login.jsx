import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";

export function Login() {
  const { status, user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <LoadingState label="Restoring your session" fullScreen />;
  }

  if (status === "authenticated") {
    return <Navigate to={user?.role === "professor" ? "/professor" : "/student"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Password is required.";
    }
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const authenticatedUser = await login({ email: email.trim(), password });
      const intended = location.state?.from;
      navigate(
        intended && intended.startsWith(`/${authenticatedUser.role === "professor" ? "professor" : "student"}`)
          ? intended
          : authenticatedUser.role === "professor"
            ? "/professor"
            : "/student",
        { replace: true },
      );
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-collabrix-accent/30 bg-collabrix-accent/10">
            <GraduationCap className="h-6 w-6 text-violet-300" />
          </div>
          <div>
            <p className="text-lg font-bold">Collabrix</p>
            <p className="text-xs text-collabrix-muted">Student Groups & Assignment Management</p>
          </div>
        </div>
        <Card className="p-5 sm:p-7">
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-collabrix-muted">Continue to your Collabrix workspace.</p>
          {serverError ? <ErrorState message={serverError} className="mt-5" /> : null}
          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-collabrix-muted" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  value={email}
                  error={errors.email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.email ? <p id="email-error" className="mt-2 text-xs text-red-300">{errors.email}</p> : null}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-collabrix-muted" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  error={errors.password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.password ? <p id="password-error" className="mt-2 text-xs text-red-300">{errors.password}</p> : null}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-collabrix-muted">
            Student without an account?{" "}
            <Link className="font-semibold text-violet-300 hover:text-violet-200" to="/register">
              Register
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
