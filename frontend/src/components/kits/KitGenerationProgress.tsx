"use client";
import { useEffect, useState } from "react";
import type { KitStep } from "@/lib/types";

const STEPS = [
  { key: "queued", label: "Queued" },
  { key: "extracting", label: "Extracting requirements" },
  { key: "crawling", label: "Crawling company site" },
  { key: "brief", label: "Writing company brief" },
  { key: "generating", label: "Generating questions" },
  { key: "coverage", label: "Coverage pass" },
  { key: "scheduling", label: "Building schedule" },
  { key: "done", label: "Ready" },
];

interface LiveState {
  status: string;
  steps?: KitStep[];
}

export default function KitGenerationProgress({
  kitId,
  status,
}: {
  kitId: string;
  status: string;
}) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [sseFailed, setSseFailed] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === "done" || status === "failed") return;
    const src = new EventSource(`/api/kits/${kitId}/stream`);
    src.onmessage = (e) => {
      try {
        setLive(JSON.parse(e.data) as LiveState);
      } catch {
        /* ignore malformed frame */
      }
    };
    src.onerror = () => {
      setSseFailed(true);
      src.close();
    };
    return () => src.close();
  }, [kitId, status]);

  // polling fallback when SSE stalls (Vercel buffering)
  useEffect(() => {
    if (!sseFailed || status === "done" || status === "failed") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/kits/${kitId}`, { credentials: "include" });
        const k = (await r.json()) as { status: string; steps?: KitStep[] };
        setLive({ status: k.status, steps: k.steps });
        if (k.status === "done" || k.status === "failed") {
          clearInterval(t);
          window.location.reload();
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [sseFailed, kitId, status]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const cur = live?.status || status;
  const mapped = cur === "running" ? "generating" : cur;
  const idx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === mapped)
  );
  const pct = ((idx + 1) / STEPS.length) * 100;

  return (
    <div className="card" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Generating your kit</p>
        <span className="font-mono text-[11px] text-pebble">
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
          {String(elapsed % 60).padStart(2, "0")} elapsed · step{" "}
          {Math.min(idx + 1, STEPS.length)}/{STEPS.length}
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-flint">
        <div
          className="h-full rounded-full bg-indigo transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-5 flex flex-col gap-2.5">
        {STEPS.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-sm font-mono text-[10px] ${
                  state === "current"
                    ? "bg-indigo text-paper"
                    : state === "done"
                      ? "bg-flint text-graphite"
                      : "bg-marble text-ash"
                }`}
                aria-hidden
              >
                {state === "done" ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={
                  state === "current"
                    ? "text-sm font-medium text-onyx"
                    : state === "done"
                      ? "text-sm text-graphite"
                      : "text-sm text-ash"
                }
              >
                {s.label}
              </span>
              {state === "current" && (
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-indigo" />
              )}
            </li>
          );
        })}
      </ol>

      {sseFailed && (
        <p className="mt-4 font-mono text-[11px] text-ash">
          Live stream buffered — polling every 3s instead.
        </p>
      )}
      <p className="mt-4 text-sm text-pebble">
        Typical run: 30–90 seconds. You can leave this page — we&apos;ll keep going.
      </p>
    </div>
  );
}
