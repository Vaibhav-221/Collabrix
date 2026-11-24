export function LoadingState({ label = "Loading", fullScreen = false }) {
  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? "min-h-screen" : "min-h-40"} w-full`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm text-collabrix-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-collabrix-border border-t-collabrix-accent" />
        {label}
      </div>
    </div>
  );
}
