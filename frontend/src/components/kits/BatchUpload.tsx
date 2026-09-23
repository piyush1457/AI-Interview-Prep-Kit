"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/atoms/Button";

interface BatchItem {
  jd: string;
  company_url: string;
  days: number;
}

// In-app multi-role upload (Sec 2, separate from CLI Sec 9): file or textarea (JSON / jd|url|days lines).
export default function BatchUpload({ onDone }: { onDone: (ids: string[]) => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const t = await file.text();
      setText(t.trim());
      setMsg(`Loaded ${file.name}`);
    } catch {
      setMsg("Could not read that file.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const parseRows = (t: string): BatchItem[] => {
    if (t.startsWith("[")) {
      return JSON.parse(t) as BatchItem[];
    }
    return t
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [jd, company_url, days] = line.split("|").map((s) => s.trim());
        return { jd, company_url, days: Number(days) };
      });
  };

  const submit = async () => {
    setMsg("");
    setPending(true);
    try {
      const items = parseRows(text.trim());
      if (items.length > 20) {
        setMsg("Max 20 rows per batch.");
        return;
      }
      const r = await api.batch(items);
      onDone(r.kitIds ?? []);
      setText("");
      setMsg(
        `Queued ${(r.kitIds ?? []).length} kits${
          (r.rowErrors ?? []).length ? `, ${r.rowErrors?.length} row errors` : ""
        }.`
      );
    } catch (e: unknown) {
      if (e instanceof SyntaxError) setMsg("Could not parse rows - check the format.");
      else if (e instanceof Error) setMsg(e.message);
      else setMsg("Batch failed - try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <details className="card">
      <summary className="cursor-pointer list-none">
        <span className="eyebrow">03 · Batch upload - prepare for multiple roles</span>
        <span className="ml-2 text-pebble" aria-hidden>
          ▾
        </span>
      </summary>
      <p className="mt-3 text-sm text-pebble">
        Upload a file, or paste a JSON array / lines of{" "}
        <code className="font-mono text-xs">jd | company_url | days</code> (max 20 rows).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="btn btn-outline btn-sm cursor-pointer">
          Choose file
          <input
            ref={fileRef}
            type="file"
            accept=".json,.txt,.csv,application/json,text/plain"
            className="sr-only"
            aria-label="Batch file (JSON or text rows)"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        <span className="text-xs text-ash">.json / .txt / .csv</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="textarea mt-3 font-mono text-xs"
        placeholder='[{"jd":"...","company_url":"https://...","days":5}]'
        aria-label="Batch rows"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void submit()}
          pending={pending}
          disabled={!text.trim()}
        >
          Queue batch
        </Button>
        {msg && (
          <span className="text-sm text-graphite" role="status">
            {msg}
          </span>
        )}
      </div>
    </details>
  );
}
