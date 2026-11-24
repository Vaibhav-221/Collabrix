export function Input({ id, error, className = "", ...props }) {
  return (
    <input
      id={id}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`min-h-11 w-full rounded-lg border bg-collabrix-background px-3 py-2 text-sm text-collabrix-text placeholder:text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-collabrix-accent ${
        error
          ? "border-collabrix-danger"
          : "border-collabrix-border focus:border-collabrix-accent"
      } ${className}`}
      {...props}
    />
  );
}
