"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { markEdited, nextQuestionId } from "@/lib/kitState";
import KitGenerationProgress from "@/components/kits/KitGenerationProgress";
import ThinKitNotice from "@/components/kits/ThinKitNotice";
import BriefEditor from "@/components/kits/BriefEditor";
import QuestionList from "@/components/kits/QuestionList";

const CATS = ["technical", "behavioural", "system-design", "company-fit"];

export default function KitBuilderPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [doc, setDoc] = useState<any>(null);
  const [err, setErr] = useState("");
  const [conflict, setConflict] = useState("");
  const [saving, setSaving] = useState(false);
  const timer = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const k = await api.getKit(id);
      setDoc(k);
      setErr("");
      if ((k.status === "done" || k.status === "failed") && !k.kit) setErr("Generation failed — retry from the kits list.");
    } catch (e: any) {
      setErr(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!doc || doc.status === "done" || doc.status === "failed") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [doc, load]);

  const scheduleSave = useCallback((nextKit: any, version: number) => {
    setSaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const saved = await api.patchKit(id, nextKit, version);
        setDoc(saved);
        setConflict("");
      } catch (e: any) {
        if (e.code === 409) {
          setConflict("Someone (or another tab) changed this kit — reloaded fresh. Re-apply your edit.");
          if (e.kit) setDoc(e.kit);
        } else setErr(e.message);
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [id]);

  const updateKit = (fn: (kit: any) => any) => {
    if (!doc?.kit) return;
    const nextKit = fn(structuredClone(doc.kit));
    setDoc({ ...doc, kit: nextKit });
    scheduleSave(nextKit, doc.version);
  };

  const regen = async (scope: any) => {
    try {
      const saved = await api.regenerate(id, scope, doc.version);
      setDoc(saved);
    } catch (e: any) {
      if (e.code === 409 && e.kit) { setConflict("Stale version — reloaded fresh."); setDoc(e.kit); }
      else setErr(e.message);
    }
  };

  if (err && !doc) return <div className="p-8 text-red-600">{err} <Link href="/kits" className="underline">Back</Link></div>;
  if (!doc) return <div className="p-8">Loading…</div>;
  if (doc.status !== "done") {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8">
        <Link href="/kits" className="text-sm underline">← Kits</Link>
        <KitGenerationProgress kitId={id} status={doc.status} />
        {doc.status === "failed" && <p className="text-red-600">Generation failed: {doc.error?.message} <button className="underline" onClick={load}>Retry</button></p>}
      </div>
    );
  }

  const kit = doc.kit;
  const byCat = (c: string) => (kit.questions || []).filter((q: any) => q.category === c);
  const thin = (kit.role?.requirements || []).length <= 2;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <Link href="/kits" className="text-sm underline">← Kits</Link>
        <div className="flex items-center gap-3 text-sm">
          {saving && <span className="text-zinc-500">Saving…</span>}
          <Link href={`/kits/${id}/practice`} className="rounded bg-black px-4 py-2 text-white">Practice →</Link>
        </div>
      </div>
      {conflict && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm" role="alert">{conflict}</div>}
      <h1 className="text-2xl font-bold">{kit.role?.title} <span className="text-base font-normal text-zinc-500">@ {kit.source?.company}</span></h1>
      {thin && <ThinKitNotice reqCount={(kit.role?.requirements || []).length} />}

      <BriefEditor brief={kit.company_brief}
        onSave={(b: any) => {
          if (b?.regen) { regen({ type: "brief" }); return; }
          updateKit((k) => ({ ...k, company_brief: { ...k.company_brief, summary: b.summary, what_they_do: b.what_they_do, _meta: { origin: "edited" } } }));
        }} />

      {CATS.map((c) => (
        <QuestionList key={c} category={c} questions={byCat(c)}
          onReorder={(ids) => updateKit((k) => {
            const others = (k.questions || []).filter((q: any) => q.category !== c);
            const map = new Map((k.questions || []).map((q: any) => [q.id, q]));
            return { ...k, questions: [...others, ...ids.map((x: string) => map.get(x)).filter(Boolean)] };
          })}
          onEdit={(q) => updateKit((k) => ({ ...k, questions: (k.questions || []).map((x: any) => (x.id === q.id ? q : x)) }))}
          onMove={(q) => updateKit((k) => ({ ...k, questions: (k.questions || []).map((x: any) => (x.id === q.id ? q : x)) }))}
          onDelete={(qid) => updateKit((k) => ({ ...k, questions: (k.questions || []).filter((x: any) => x.id !== qid) }))}
          onAdd={() => updateKit((k) => {
            const nid = nextQuestionId(k.questions || []);
            const r1 = (k.role?.requirements || [])[0]?.id || "r1";
            return { ...k, questions: [...(k.questions || []), markEdited({ id: nid, requirement_ids: [r1], category: c, prompt: "New question — edit me", answer_outline: "Outline…", difficulty: 1 })] };
          })}
          onRegen={() => regen({ type: "category", category: c })}
        />
      ))}

      <section className="rounded border p-4" aria-label="Study schedule">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Schedule ({kit.schedule?.days_available} days)</h2>
          <button className="rounded border px-3 py-1 text-sm" onClick={() => regen({ type: "schedule" })}>Regenerate schedule</button>
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {(kit.schedule?.days || []).map((d: any) => (
            <li key={d.day} className="flex justify-between border-b py-1">
              <span>Day {d.day} — {d.focus} <span className="text-zinc-500">({(d.question_ids || []).join(", ")})</span></span>
              <span>{d.minutes} min</span>
            </li>
          ))}
        </ul>
        {(kit.coverage?.uncovered_requirement_ids || []).length > 0 && (
          <p className="mt-2 text-sm text-amber-700">Uncovered must-haves: {kit.coverage.uncovered_requirement_ids.join(", ")} (passes: {kit.coverage.passes})</p>
        )}
      </section>
    </div>
  );
}
