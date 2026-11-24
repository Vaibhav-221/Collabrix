export function Button({
  variant = "primary",
  type = "button",
  className = "",
  disabled,
  children,
  ...props
}) {
  const variants = {
    primary:
      "border-collabrix-accent bg-collabrix-accent text-white hover:bg-collabrix-accent-hover",
    secondary:
      "border-collabrix-border bg-collabrix-elevated text-collabrix-text hover:border-collabrix-muted",
    danger:
      "border-collabrix-danger/50 bg-collabrix-danger/10 text-red-200 hover:bg-collabrix-danger/20",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-collabrix-accent focus-visible:ring-offset-2 focus-visible:ring-offset-collabrix-background disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
