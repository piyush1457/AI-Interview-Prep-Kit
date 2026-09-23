"use client";
import { useCallback, useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { BriefSave, Flashcard, KitDoc, KitEnvelope, Question, RegenScope } from "@/lib/types";
import { markEdited, nextQuestionId, nextFlashcardId } from "@/lib/kitState";
import AppShell from "@/components/organisms/AppShell";
import Button from "@/components/atoms/Button";
import Spinner from "@/components/atoms/Spinner";
import KitGenerationProgress from "@/components/kits/KitGenerationProgress";
import ThinKitNotice from "@/components/kits/ThinKitNotice";
import BriefEditor from "@/components/kits/BriefEditor";
import QuestionList from "@/components/kits/QuestionList";
import FlashcardList from "@/components/kits/FlashcardList";

const CATS = ["technical", "behavioural", "system-design", "company-fit"];
const CAT_EYEBROW: Record<string, string> = {
  technical: "02 · Technical",
  behavioural: "03 · Behavioural",
  "system-design": "04 · System design",
  "company-fit": "05 · Company fit",
};

function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Request failed - try again.";
}

function BuilderContent({ id }: { id: string }) {
  const [doc, setDoc] = useState<KitEnvelope | null>(null);
  const [err, setErr] = useState("");
  const [conflict, setConflict] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [regenScope, setRegenScope] = useState<string | null>(null);
  const [regenTick, setRegenTick] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<{ kit: KitDoc; version: number } | null>(null);
  const regenTickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const k = await api.getKit(id);
      setDoc(k);
      setErr("");
      if ((k.status === "done" || k.status === "failed") && !k.kit)
        setErr("Generation failed - retry from the kits list.");
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
          setErr("Generation failed - retry from the kits list.");
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

  const flushPendingSave = useCallback(async (): Promise<number> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const payload = pendingSave.current;
    pendingSave.current = null;
    if (!payload) {
      const v = Number(doc?.version);
      return Number.isInteger(v) && v >= 1 ? v : 0;
    }
    try {
      const saved = await api.patchKit(id, payload.kit, payload.version);
      setDoc(saved);
      setConflict("");
      setSavedTick(true);
      setSaveFailed(false);
      return saved.version ?? payload.version;
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === 409) {
        setConflict("Someone (or another tab) changed this kit - reloaded fresh. Re-apply your edit.");
        if (e.kit) setDoc(e.kit);
        setSaveFailed(false);
      } else {
        setErr(errText(e));
        setSaveFailed(true);
        setSavedTick(false);
      }
      return doc?.version ?? 0;
    } finally {
      setSaving(false);
    }
  }, [doc?.version, id]);

  const scheduleSave = useCallback(
    (nextKit: KitDoc, version: number) => {
      setSaving(true);
      setSavedTick(false);
      setSaveFailed(false);
      pendingSave.current = { kit: nextKit, version };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flushPendingSave();
      }, 600);
    },
    [flushPendingSave]
  );

  const updateKit = (fn: (kit: KitDoc) => KitDoc) => {
    if (!doc?.kit) return;
    const nextKit = fn(structuredClone(doc.kit));
    setDoc({ ...doc, kit: nextKit });
    // If-Match is required server-side; never send a zero/missing version.
    const ver = Number(doc.version);
    if (!Number.isInteger(ver) || ver < 1) {
      setSaveFailed(true);
      setErr("Could not determine kit version - reload and try again.");
      return;
    }
    scheduleSave(nextKit, ver);
  };

  const showRegenTick = () => {
    setRegenTick(true);
    if (regenTickTimer.current) clearTimeout(regenTickTimer.current);
    regenTickTimer.current = setTimeout(() => setRegenTick(false), 2500);
  };

  const regen = async (scope: RegenScope) => {
    const scopeKey =
      scope.type === "category" ? `category:${scope.category}` : scope.type;
    setRegenScope(scopeKey);
    setErr("");
    try {
      // Flush any debounced PATCH first so If-Match uses the server version.
      const version = await flushPendingSave();
      if (!Number.isInteger(version) || version < 1) {
        setErr("Could not determine kit version - reload and try again.");
        return;
      }
      const saved = await api.regenerate(id, scope, version);
      setDoc(saved);
      setConflict("");
      showRegenTick();
    } catch (e: unknown) {
      if (e instanceof ApiError && e.code === 409 && e.kit) {
        setConflict("Stale version - reloaded fresh. Try regenerate again.");
        setDoc(e.kit);
      } else setErr(errText(e));
    } finally {
      setRegenScope(null);
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
        <KitGenerationProgress
          kitId={id}
          status={doc.status}
          onTerminal={() => {
            void load();
          }}
        />
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
  const reqText = new Map((kit.role?.requirements ?? []).map((r) => [r.id, r.text || r.id]));
  const qById = new Map(questions.map((q) => [q.id, q]));
  const dayTopics = (ids: string[] | undefined) => {
    const topics = new Set<string>();
    for (const qid of ids ?? []) {
      const q = qById.get(qid);
      for (const rid of q?.requirement_ids ?? []) {
        const t = reqText.get(rid);
        if (t) topics.add(t.length > 28 ? `${t.slice(0, 28)}…` : t);
      }
    }
    return [...topics].slice(0, 3).join(" · ");
  };

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
            ) : saveFailed ? (
              <span className="text-danger" role="alert">
                Save failed - see error below
              </span>
            ) : savedTick ? (
              <span className="text-success">✓ Saved</span>
            ) : regenTick ? (
              <span className="text-success">✓ Regenerated</span>
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

      {(doc.warnings ?? []).length > 0 && (
        <div className="card mt-5 border-warning bg-paper" role="status" aria-label="Research notes">
          <p className="font-mono text-[11px] uppercase tracking-wider text-warning">
            Research notes - sources skipped or incomplete
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {(doc.warnings ?? []).map((w) => (
              <li key={w} className="text-sm text-charcoal">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <BriefEditor
          brief={kit.company_brief}
          regenPending={regenScope === "brief"}
          onSave={(b: BriefSave) => {
            if ("regen" in b) {
              void regen({ type: "brief" });
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
                  prompt: "New question - edit me",
                  answer_outline: "Outline…",
                  difficulty: 1,
                });
                return { ...k, questions: [...(k.questions ?? []), added] };
              })
            }
            onRegen={() => void regen({ type: "category", category: c })}
            regenPending={regenScope === `category:${c}`}
          />
        ))}

        <FlashcardList
          cards={(kit.flashcards ?? []) as Flashcard[]}
          onEdit={(fc) =>
            updateKit((k) => ({
              ...k,
              flashcards: (k.flashcards ?? []).map((x) => (x.id === fc.id ? fc : x)),
            }))
          }
          onDelete={(fid) =>
            updateKit((k) => ({
              ...k,
              flashcards: (k.flashcards ?? []).filter((x) => x.id !== fid),
            }))
          }
          onAdd={() =>
            updateKit((k) => {
              const nid = nextFlashcardId(k.flashcards ?? []);
              const r1 = (k.role?.requirements ?? [])[0]?.id || "r1";
              const added: Flashcard = markEdited({
                id: nid,
                front: "New flashcard front - edit me",
                back: "Answer…",
                requirement_ids: [r1],
              });
              return { ...k, flashcards: [...(k.flashcards ?? []), added] };
            })
          }
        />

        <section className="card" aria-label="Study schedule">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">06 · Schedule - {kit.schedule?.days_available} days</p>
            <Button
              size="sm"
              variant="outline"
              pending={regenScope === "schedule"}
              onClick={() => void regen({ type: "schedule" })}
            >
              {regenScope === "schedule" ? "Regenerating…" : "Regenerate schedule"}
            </Button>
          </div>
          <ul className="mt-4 flex flex-col">
            {(kit.schedule?.days ?? []).map((d) => (
              <li
                key={d.day}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-flint py-3 last:border-0"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-pebble">
                      DAY {String(d.day).padStart(2, "0")}
                    </span>
                    <span className="font-medium">{d.focus}</span>
                  </span>
                  {dayTopics(d.question_ids) && (
                    <span className="ml-10 text-[13px] leading-snug text-pebble">
                      {dayTopics(d.question_ids)}
                    </span>
                  )}
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
