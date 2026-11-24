export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-collabrix-border bg-collabrix-surface shadow-panel ${className}`}>
      {children}
    </div>
  );
}
