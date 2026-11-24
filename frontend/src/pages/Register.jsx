import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { GraduationCap, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getApiErrorMessage } from "../utils/apiError";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import { Input } from "../components/ui/Input";
import { Label } from "../components/ui/Label";

export function Register() {
  const { status, user, register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (fullName.trim().length < 2) {
      nextErrors.fullName = "Full name must be at least 2 characters.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!studentId.trim()) {
      nextErrors.studentId = "Student ID is required.";
    }
    if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        studentId: studentId.trim(),
        password,
      });
      navigate("/student", { replace: true });
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
          <h1 className="text-xl font-bold">Create student account</h1>
          <p className="mt-1 text-sm text-collabrix-muted">Register with your university details.</p>
          {serverError ? <ErrorState message={serverError} className="mt-5" /> : null}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <Field id="fullName" label="Full name" error={errors.fullName}>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-collabrix-muted" />
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  value={fullName}
                  error={errors.fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="pl-10"
                />
              </div>
            </Field>
            <Field id="email" label="University email" error={errors.email}>
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
            </Field>
            <Field id="studentId" label="Student ID" error={errors.studentId}>
              <Input
                id="studentId"
                type="text"
                autoComplete="off"
                placeholder="STU10045"
                value={studentId}
                error={errors.studentId}
                onChange={(event) => setStudentId(event.target.value)}
              />
            </Field>
            <Field id="password" label="Password" error={errors.password}>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-collabrix-muted" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  error={errors.password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-10"
                />
              </div>
            </Field>
            <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-collabrix-muted" />
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  error={errors.confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="pl-10"
                />
              </div>
            </Field>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account..." : "Create student account"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-collabrix-muted">
            Already have an account?{" "}
            <Link className="font-semibold text-violet-300 hover:text-violet-200" to="/login">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p id={`${id}-error`} className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
