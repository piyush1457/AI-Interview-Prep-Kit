"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/atoms/Button";

interface BatchItem {
  jd: string;
  company_url: string;
  days: number;
}

// In-app multi-role upload (Sec 2, separate from CLI Sec 9): JSON array or jd|company_url|days lines.
export default function BatchUpload({ onDone }: { onDone: (ids: string[]) => void }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);

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
      if (e instanceof SyntaxError) setMsg("Could not parse rows — check the format.");
      else if (e instanceof Error) setMsg(e.message);
      else setMsg("Batch failed — try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <details className="card">
      <summary className="cursor-pointer list-none">
        <span className="eyebrow">03 · Batch upload — prepare for multiple roles</span>
        <span className="ml-2 text-pebble" aria-hidden>
          ▾
        </span>
      </summary>
      <p className="mt-3 text-sm text-pebble">
        Paste a JSON array, or lines of{" "}
        <code className="font-mono text-xs">jd | company_url | days</code> (max 20 rows).
      </p>
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
