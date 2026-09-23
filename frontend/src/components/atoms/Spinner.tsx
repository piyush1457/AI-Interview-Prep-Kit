export default function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-pebble" role="status">
      <span
        aria-hidden
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-graphite border-t-transparent"
      />
      <span className="font-mono text-xs uppercase tracking-wider">{label}</span>
    </div>
  );
}
