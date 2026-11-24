export function Label({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-collabrix-text">
      {children}
    </label>
  );
}
