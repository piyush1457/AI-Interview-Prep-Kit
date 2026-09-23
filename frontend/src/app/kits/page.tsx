"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import BatchUpload from "@/components/kits/BatchUpload";

export default function KitsPage() {
  const [kits, setKits] = useState<any[]>([]);
  const [jd, setJd] = useState("");
  const [url, setUrl] = useState("");
  const [days, setDays] = useState(5);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const load = async () => {
    try { setKits(await api.listKits()); } catch (e: any) { setMsg(e.message); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setMsg("");
    try {
      const r = await api.createKit(jd, url, days);
      router.push(`/kits/${r.kitId}`);
    } catch (e: any) { setMsg(e.message); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Your Kits</h1>
      <section className="rounded border p-4" aria-label="Create kit">
        <h2 className="font-semibold">New kit</h2>
        <label className="mt-2 block text-sm font-medium">Job description
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={5}
            className="mt-1 w-full rounded border p-2" placeholder="Paste the posting text…" />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="flex-1 text-sm font-medium">Company website
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
              className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="w-28 text-sm font-medium">Days
            <input type="number" min={1} max={60} value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1 w-full rounded border p-2" />
          </label>
        </div>
        <button className="mt-3 rounded bg-black px-4 py-2 text-white" onClick={create} disabled={!jd.trim() || !url.trim()}>
          Generate kit
        </button>
        {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
      </section>

      <BatchUpload onDone={(ids) => { setMsg(`Queued ${ids.length} kits.`); load(); }} />

      {kits.length === 0 ? (
        <div className="rounded border border-dashed p-8 text-center text-zinc-500">No kits yet — paste a description above.</div>
      ) : (
        <ul className="space-y-2">
          {kits.map((k: any) => (
            <li key={k.id} className="flex justify-between rounded border p-3">
              <span>{k.id.slice(-6)} · {k.status}</span>
              <Link href={`/kits/${k.id}`} className="underline">Open →</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
