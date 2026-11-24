export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-xl border border-dashed border-collabrix-border bg-collabrix-surface/50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-collabrix-text">{title}</p>
      {message ? <p className="mt-2 text-sm text-collabrix-muted">{message}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
