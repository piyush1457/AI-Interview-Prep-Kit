"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <h2 className="font-semibold text-red-600">Failed to load kits</h2>
      <p className="text-sm text-zinc-600">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded bg-black px-4 py-2 text-white">
        Retry
      </button>
    </div>
  );
}
