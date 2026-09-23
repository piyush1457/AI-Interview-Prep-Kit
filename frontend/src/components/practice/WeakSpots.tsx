"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function WeakSpots({ kitId }: { kitId: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.weakSpots(kitId).then(setData).catch(() => {}); }, [kitId]);
  if (!data) return null;
  return (
    <section className="rounded border border-purple-200 bg-purple-50 p-4 print-break" aria-label="Weak spots report">
      <h3 className="font-semibold">Weak-spots report</h3>
      <p className="mt-1 text-sm">{data.summary}</p>
      {data.lowConfidenceCards?.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {data.lowConfidenceCards.map((c: any) => <li key={c.id}>{c.front?.slice(0, 80)}…</li>)}
        </ul>
      )}
      {data.uncoveredMusts?.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {data.uncoveredMusts.map((m: any) => <li key={m.id}>Uncovered: {m.text?.slice(0, 80)}</li>)}
        </ul>
      )}
    </section>
  );
}
