import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useAuth } from "../context/AuthContext";

export function StudentHome() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-violet-300">Student workspace</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Welcome, {user?.fullName}</h1>
      </div>
      <Card className="p-5 sm:p-6">
        <EmptyState
          title="Student features are being prepared"
          message="Group management, assignments, progress, and submission tools will appear here in later phases."
        />
      </Card>
    </div>
  );
}
