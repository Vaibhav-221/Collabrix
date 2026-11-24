export function ErrorState({ title = "Something went wrong", message, children }) {
  return (
    <div role="alert" className="rounded-lg border border-collabrix-danger/40 bg-collabrix-danger/10 px-4 py-3">
      <p className="text-sm font-semibold text-red-200">{title}</p>
      {message ? <p className="mt-1 text-sm text-red-100/80">{message}</p> : null}
      {children}
    </div>
  );
}
