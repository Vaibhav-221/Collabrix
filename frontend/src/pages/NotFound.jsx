import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md p-7 text-center">
        <p className="text-5xl font-bold text-violet-300">404</p>
        <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
        <Link to="/" className="mt-6 inline-flex">
          <Button>Return home</Button>
        </Link>
      </Card>
    </main>
  );
}
