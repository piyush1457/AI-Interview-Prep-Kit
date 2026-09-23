"use client";
import { useState } from "react";

export default function BriefEditor({ brief, onSave }: { brief: any; onSave: (b: any) => void }) {
  const [summary, setSummary] = useState(brief?.summary || "");
  const [what, setWhat] = useState(brief?.what_they_do || "");
  return (
    <section className="rounded border p-4" aria-label="Company brief">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Company brief</h2>
        <button
          className="rounded border px-3 py-1 text-sm"
          data-regen="brief"
          onClick={() => onSave({ regen: "brief" })}
        >
          Regenerate brief
        </button>
      </div>
      <label className="mt-3 block text-sm font-medium">Summary
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
          className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="mt-3 block text-sm font-medium">What they do
        <textarea value={what} onChange={(e) => setWhat(e.target.value)} rows={2}
          className="mt-1 w-full rounded border p-2" />
      </label>
      <button
        className="mt-3 rounded bg-black px-4 py-2 text-white"
        onClick={() => onSave({ summary, what_they_do: what, _meta: { origin: "edited" } })}
      >
        Save brief
      </button>
    </section>
  );
}
