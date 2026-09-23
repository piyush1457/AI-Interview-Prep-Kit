"use client";
import { useState } from "react";
import { api } from "@/lib/api";

// In-app multi-role upload (Sec 2, separate from CLI Sec 9): JSON array or CSV jd,company_url,days.
export default function BatchUpload({ onDone }: { onDone: (ids: string[]) => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async () => {
    setMsg("");
    try {
      let items: any[];
      const t = text.trim();
      if (t.startsWith("[")) {
        items = JSON.parse(t);
      } else {
        items = t.split("\n").filter(Boolean).map((line) => {
          const [jd, company_url, days] = line.split("|").map((s) => s.trim());
          return { jd, company_url, days: Number(days) };
        });
      }
      if (items.length > 20) { setMsg("Max 20 rows per batch."); return; }
      const r = await api.batch(items);
      onDone(r.kitIds || []);
      setMsg(`Queued ${(r.kitIds || []).length} kits${(r.rowErrors || []).length ? `, ${r.rowErrors.length} row errors` : ""}.`);
    } catch (e: any) {
      setMsg(e.message);
    }
  };
  return (
    <section className="rounded border p-4" aria-label="Batch upload">
      <h2 className="font-semibold">Prepare for multiple roles</h2>
      <p className="mt-1 text-xs text-zinc-500">Paste JSON array or lines of <code>jd | company_url | days</code> (max 20 rows).</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
        className="mt-2 w-full rounded border p-2 font-mono text-xs" placeholder='[{"jd":"...","company_url":"https://...","days":5}]' />
      <button className="mt-2 rounded bg-black px-4 py-2 text-sm text-white" onClick={submit}>Queue batch</button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </section>
  );
}
