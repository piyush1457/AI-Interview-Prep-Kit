"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WeakSpotsReport } from "@/lib/types";

export default function WeakSpots({ kitId }: { kitId: string }) {
  const [data, setData] = useState<WeakSpotsReport | null>(null);
  useEffect(() => {
    api
      .weakSpots(kitId)
      .then(setData)
      .catch(() => {
        /* section hides itself when unavailable */
      });
  }, [kitId]);
  if (!data) return null;

  const shaky = data.lowConfidenceCards ?? [];
  const musts = data.uncoveredMusts ?? [];

  return (
    <section className="card print-break" aria-label="Weak spots report">
      <p className="eyebrow">Weak spots</p>
      <p className="mt-3 text-sm leading-relaxed text-graphite">{data.summary}</p>

      {shaky.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-warning">
            Shaky cards — queue these first
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {shaky.map((c) => (
              <li key={c.id} className="flex gap-2 text-sm text-charcoal">
                <span className="text-ash" aria-hidden>
                  ·
                </span>
                <span>{c.front?.slice(0, 100)}…</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {musts.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-danger">
            Uncovered must-haves
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {musts.map((m) => (
              <li key={m.id} className="flex gap-2 text-sm text-charcoal">
                <span className="font-mono text-[11px] text-ash">{m.id}</span>
                <span>{m.text?.slice(0, 90)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shaky.length === 0 && musts.length === 0 && (
        <p className="mt-3 text-sm text-success">Nothing flagged — keep the streak going.</p>
      )}
    </section>
  );
}
