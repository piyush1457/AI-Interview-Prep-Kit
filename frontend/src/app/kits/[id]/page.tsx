"use client";
import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { BriefSave, KitDoc, KitEnvelope, Question, RegenScope } from "@/lib/types";
import { markEdited, nextQuestionId } from "@/lib/kitState";
import AppShell from "@/components/organisms/AppShell";
import Button from "@/components/atoms/Button";
import Spinner from "@/components/atoms/Spinner";
import KitGenerationProgress from "@/components/kits/KitGenerationProgress";
import ThinKitNotice from "@/components/kits/ThinKitNotice";
import BriefEditor from "@/components/kits/BriefEditor";
import QuestionList from "@/components/kits/QuestionList";

const CATS = ["technical", "behavioural", "system-design", "company-fit"];
const CAT_EYEBROW: Record<string, string> = {
  technical: "02 · Technical",
  behavioural: "03 · Behavioural",
  "system-design": "04 · System design",
  "company-fit": "05 · Company fit",
};

function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Request failed — try again.";
}

function BuilderContent({ id }: { id: string }) {
  const [doc, setDoc] = useState<KitEnvelope | null>(null);
  const [err, setErr] = useState("");
  const [conflict, setConflict] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const k = await api.getKit(id);
      setDoc(k);
      setErr("");
      if ((k.status === "done" || k.status === "failed") && !k.kit)
        setErr("Generation failed — retry from the kits list.");
    } catch (e: unknown) {
      setErr(errText(e));
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const k = await api.getKit(id);
        if (!active) return;
        setDoc(k);
        setErr("");
        if ((k.status === "done" || k.status === "failed") && !k.kit)
          setErr("Generation failed — retry from the kits list.");
      } catch (e: unknown) {
        if (active) setErr(errText(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!doc || doc.status === "done" || doc.status === "failed") return;
    const t = setInterval(() => {
      void load();
    }, 3000);
    return () => clearInterval(t);
  }, [doc, load]);

  const scheduleSave = useCallback(
    (nextKit: KitDoc, version: number) => {
      setSaving(true);
      setSavedTick(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          const saved = await api.patchKit(id, nextKit, version);
          setDoc(saved);
          setConflict("");
          setSavedTick(true);
        } catch (e: unknown) {
          if (e instanceof ApiError && e.code === 409) {
            setConflict(
              "Someone (or another tab) changed this kit — reloaded fresh. Re-apply your edit."
            );
            if (e.kit) setDoc(e.kit);
          } else setErr(errText(e));
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [id]
  );

  const updateKit = (fn: (kit: KitDoc) => KitDoc) => {
    if (!doc?.kit) return;
    const nextKit = fn(structuredClone(doc.kit));
    setDoc({ ...doc, kit: nextKit });
    scheduleSave(nextKit, doc.version ?? 0);
  };

  const regen = async (scope: RegenScope) => {
    try {
      const saved = await api.regenerate(id, scope, doc?.version ?? 0);
      setDoc(saved);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === 409 && e.kit) {
        setConflict("Stale version — reloaded fresh.");
        setDoc(e.kit);
      } else setErr(errText(e));
    }
  };

  if (err && !doc)
    return (
      <div className="card max-w-lg">
        <p className="text-sm text-danger" role="alert">
          {err}
        </p>
        <Link href="/kits" className="btn btn-outline mt-4">
          ← Back to kits
        </Link>
      </div>
    );

  if (!doc)
    return (
      <div className="py-8">
        <Spinner label="Loading kit…" />
      </div>
    );

  if (doc.status !== "done") {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/kits" className="btn btn-ghost btn-sm -ml-3">
          ← Kits
        </Link>
        <KitGenerationProgress kitId={id} status={doc.status} />
        {doc.status === "failed" && (
          <div className="card border-danger bg-paper" role="alert">
            <p className="text-sm text-danger">Generation failed: {doc.error?.message}</p>
            <Button className="mt-3" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  const kit: KitDoc = doc.kit ?? {};
  const questions: Question[] = kit.questions ?? [];
  const byCat = (c: string) => questions.filter((q) => q.category === c);
  const thin = (kit.role?.requirements ?? []).length <= 2;

  return (
    <>
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <Link href="/kits" className="btn btn-ghost btn-sm -ml-3">
          ← Kits
        </Link>
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[11px] uppercase tracking-wider"
            role="status"
            aria-live="polite"
          >
            {saving ? (
              <span className="text-pebble">Saving…</span>
            ) : savedTick ? (
              <span className="text-success">✓ Saved</span>
            ) : (
              <span className="text-ash">All changes saved</span>
            )}
          </span>
          <Link href={`/kits/${id}/practice`} className="btn btn-primary btn-sm">
            Practice →
          </Link>
        </div>
      </div>

      {conflict && (
        <div className="card mt-4 border-danger bg-paper" role="alert">
          <p className="text-sm text-danger">{conflict}</p>
        </div>
      )}
      {err && (
        <div className="card mt-4 border-danger bg-paper" role="alert">
          <p className="text-sm text-danger">{err}</p>
        </div>
      )}

      <header className="mt-6">
        <p className="eyebrow">
          {kit.source?.company} · {kit.schedule?.days_available}-day plan
        </p>
        <h1 className="prose-display mt-2 text-4xl sm:text-5xl">{kit.role?.title}</h1>
      </header>

      {thin && (
        <div className="mt-5">
          <ThinKitNotice reqCount={(kit.role?.requirements ?? []).length} />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <BriefEditor
          brief={kit.company_brief}
          onSave={(b: BriefSave) => {
            if ("regen" in b) {
              regen({ type: "brief" });
              return;
            }
            updateKit((k) => ({
              ...k,
              company_brief: {
                ...k.company_brief,
                summary: b.summary,
                what_they_do: b.what_they_do,
                _meta: { origin: "edited" },
              },
            }));
          }}
        />

        {CATS.map((c) => (
          <QuestionList
            key={c}
            category={c}
            eyebrow={CAT_EYEBROW[c]}
            questions={byCat(c)}
            onReorder={(ids) =>
              updateKit((k) => {
                const all = k.questions ?? [];
                const others = all.filter((q) => q.category !== c);
                const map = new Map(all.map((q) => [q.id, q]));
                return {
                  ...k,
                  questions: [
                    ...others,
                    ...ids.map((x) => map.get(x)).filter((q): q is Question => q !== undefined),
                  ],
                };
              })
            }
            onEdit={(q) =>
              updateKit((k) => ({
                ...k,
                questions: (k.questions ?? []).map((x) => (x.id === q.id ? q : x)),
              }))
            }
            onMove={(q) =>
              updateKit((k) => ({
                ...k,
                questions: (k.questions ?? []).map((x) => (x.id === q.id ? q : x)),
              }))
            }
            onDelete={(qid) =>
              updateKit((k) => ({
                ...k,
                questions: (k.questions ?? []).filter((x) => x.id !== qid),
              }))
            }
            onAdd={() =>
              updateKit((k) => {
                const nid = nextQuestionId(k.questions ?? []);
                const r1 = (k.role?.requirements ?? [])[0]?.id || "r1";
                const added: Question = markEdited({
                  id: nid,
                  requirement_ids: [r1],
                  category: c,
                  prompt: "New question — edit me",
                  answer_outline: "Outline…",
                  difficulty: 1,
                });
                return { ...k, questions: [...(k.questions ?? []), added] };
              })
            }
            onRegen={() => void regen({ type: "category", category: c })}
          />
        ))}

        <section className="card" aria-label="Study schedule">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">06 · Schedule — {kit.schedule?.days_available} days</p>
            <Button size="sm" variant="outline" onClick={() => void regen({ type: "schedule" })}>
              Regenerate schedule
            </Button>
          </div>
          <ul className="mt-4 flex flex-col">
            {(kit.schedule?.days ?? []).map((d) => (
              <li
                key={d.day}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-flint py-3 last:border-0"
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-pebble">
                    DAY {String(d.day).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{d.focus}</span>
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-ash">
                  {(d.question_ids ?? []).length} questions · {d.minutes} min
                </span>
              </li>
            ))}
          </ul>
          {(kit.coverage?.uncovered_requirement_ids ?? []).length > 0 && (
            <p className="mt-4 text-sm text-warning" role="status">
              Uncovered must-haves:{" "}
              <span className="font-mono text-xs">
                {kit.coverage?.uncovered_requirement_ids?.join(", ")}
              </span>{" "}
              · passes: {kit.coverage?.passes}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export default function KitBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <BuilderContent id={id} />
    </AppShell>
  );
}
