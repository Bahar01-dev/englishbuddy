export default function Loader() {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1"
      role="status"
      aria-live="polite"
      aria-label="Печатает"
    >
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted" />
    </div>
  );
}
