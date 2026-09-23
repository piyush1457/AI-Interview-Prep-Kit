"use client";
import { useEffect, useState } from "react";

const STEPS = ["queued", "extracting", "crawling", "brief", "generating", "coverage", "scheduling", "done"];

export default function KitGenerationProgress({ kitId, status }: { kitId: string; status: string }) {
  const [live, setLive] = useState<{ status: string; steps?: any[] } | null>(null);
  const [sseFailed, setSseFailed] = useState(false);

  useEffect(() => {
    if (status === "done" || status === "failed") return;
    const src = new EventSource(`/api/kits/${kitId}/stream`);
    src.onmessage = (e) => {
      try { setLive(JSON.parse(e.data)); } catch {}
    };
    src.onerror = () => { setSseFailed(true); src.close(); };
    return () => src.close();
  }, [kitId, status]);

  // polling fallback when SSE stalls (Vercel buffering)
  useEffect(() => {
    if (!sseFailed || status === "done" || status === "failed") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/kits/${kitId}`, { credentials: "include" });
        const k = await r.json();
        setLive({ status: k.status, steps: k.steps });
        if (k.status === "done" || k.status === "failed") {
          clearInterval(t);
          window.location.reload();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [sseFailed, kitId, status]);

  const cur = live?.status || status;
  const idx = Math.max(0, STEPS.indexOf(cur === "running" ? "generating" : cur));
  return (
    <div className="rounded border p-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-blue-600" />
        <strong>Generating… {cur}</strong>
        <span className="text-sm text-zinc-500">step {Math.min(idx + 1, STEPS.length)}/{STEPS.length}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-zinc-200">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} />
      </div>
      {sseFailed && <p className="mt-2 text-xs text-zinc-500">Live stream buffered — polling every 3s instead.</p>}
    </div>
  );
}
