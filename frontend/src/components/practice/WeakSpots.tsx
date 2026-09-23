"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { WeakSpotsReport } from "@/lib/types";
import Button from "@/components/atoms/Button";

export default function WeakSpots({
  kitId,
  refreshKey = 0,
  onOpenCard,
}: {
  kitId: string;
  refreshKey?: number;
  onOpenCard?: (cardId: string) => void;
}) {
  const [data, setData] = useState<WeakSpotsReport | null>(null);
  useEffect(() => {
    let active = true;
    api
      .weakSpots(kitId)
      .then((r) => {
        if (active) setData(r);
      })
      .catch(() => {
        /* section hides itself when unavailable */
      });
    return () => {
      active = false;
    };
  }, [kitId, refreshKey]);
  if (!data) return null;

  const shaky = data.lowConfidenceCards ?? [];
  const musts = data.uncoveredMusts ?? [];

  return (
    <section className="card print-break" aria-label="Weak spots report" data-testid="weak-spots">
      <p className="eyebrow">Weak spots</p>
      <p className="mt-3 text-sm leading-relaxed text-graphite">{data.summary}</p>

      {shaky.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-warning">
            Shaky cards - queue these first
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {shaky.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-flint pb-2 last:border-0 last:pb-0"
                data-testid="shaky-card"
              >
                <span className="flex min-w-0 flex-1 gap-2 text-sm text-charcoal">
                  <span className="text-ash" aria-hidden>
                    ·
                  </span>
                  <span>{c.front?.slice(0, 100)}…</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="open-shaky"
                  onClick={() => onOpenCard?.(c.id)}
                  title="Open this flashcard in the runner"
                >
                  More
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              data-testid="drill-shaky"
              onClick={() => shaky[0] && onOpenCard?.(shaky[0].id)}
            >
              Drill shaky cards →
            </Button>
          </div>
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
        <p className="mt-3 text-sm text-success">Nothing flagged - keep the streak going.</p>
      )}
    </section>
  );
}
