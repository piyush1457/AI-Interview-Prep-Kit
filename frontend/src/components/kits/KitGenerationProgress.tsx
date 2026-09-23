"use client";
import { useEffect, useRef, useState } from "react";
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
  onTerminal,
}: {
  kitId: string;
  status: string;
  /** Called once when the kit reaches done/failed so the parent can reload data (no window.location). */
  onTerminal?: (status: string) => void;
}) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [sseFailed, setSseFailed] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const terminalNotified = useRef(false);

  const notifyTerminal = (s: string) => {
    if (terminalNotified.current) return;
    terminalNotified.current = true;
    onTerminal?.(s);
  };

  useEffect(() => {
    if (status === "done" || status === "failed") return;
    const src = new EventSource(`/api/kits/${kitId}/stream`);
    let consecutiveErrors = 0;
    src.onmessage = (e) => {
      consecutiveErrors = 0;
      try {
        const parsed = JSON.parse(e.data) as LiveState;
        setLive(parsed);
        if (parsed.status === "done" || parsed.status === "failed") {
          src.close();
          notifyTerminal(parsed.status);
        }
      } catch {
        /* ignore malformed frame */
      }
    };
    src.onerror = () => {
      // EventSource auto-reconnects; only fall back to polling after repeated failures.
      consecutiveErrors += 1;
      if (consecutiveErrors >= 3) {
        setSseFailed(true);
        src.close();
      }
    };
    return () => src.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitId, status]);

  // polling fallback when SSE fails (Vercel buffering / stream drop)
  useEffect(() => {
    if (!sseFailed || status === "done" || status === "failed") return;
    let stopped = false;
    const t = setInterval(async () => {
      if (stopped) return;
      try {
        const r = await fetch(`/api/kits/${kitId}`, { credentials: "include" });
        if (!r.ok) return;
        const k = (await r.json()) as { status: string; steps?: KitStep[] };
        setLive({ status: k.status, steps: k.steps });
        if (k.status === "done" || k.status === "failed") {
          stopped = true;
          clearInterval(t);
          notifyTerminal(k.status);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseFailed, kitId, status]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const cur = live?.status || status;
  // Prefer the latest pipeline step from SSE/poll so the checklist advances live.
  const stepKeys = STEPS.map((s) => s.key);
  const lastStep = [...(live?.steps ?? [])].reverse().find((s) => s.step && stepKeys.includes(s.step))?.step;
  let mapped: string;
  if (cur === "done" || lastStep === "done") mapped = "done";
  else if (lastStep && lastStep !== "queued") mapped = lastStep;
  else if (cur === "running") mapped = "generating";
  else mapped = cur;
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
          Live stream buffered - polling every 3s instead.
        </p>
      )}
      <p className="mt-4 text-sm text-pebble">
        Typical run: 30–90 seconds. You can leave this page - we&apos;ll keep going.
      </p>
    </div>
  );
}
