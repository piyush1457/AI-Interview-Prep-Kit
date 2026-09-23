"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Flashcard } from "@/lib/types";
import { orderPractice } from "@/lib/kitState";
import Button from "@/components/atoms/Button";
import EmptyState from "@/components/atoms/EmptyState";

const RATINGS = [
  { c: 1, label: "Shaky", cls: "btn-outline text-danger border-danger/40 hover:bg-[#fdecec]" },
  { c: 2, label: "OK", cls: "btn-outline text-warning border-warning/40 hover:bg-[#fdf3e3]" },
  { c: 3, label: "Solid", cls: "btn-outline text-success border-success/40 hover:bg-[#e8f5ec]" },
];

export default function FlashcardRunner({
  kitId,
  cards,
  onRated,
  focusCardId,
}: {
  kitId: string;
  cards: Flashcard[];
  onRated?: () => void;
  /** Jump to this card (e.g. from Weak spots "More"). */
  focusCardId?: string | null;
}) {
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  // Confidence may contain orphan keys; only count ratings that belong to this deck.
  const coveredIds = useMemo(
    () => new Set(cards.filter((c) => confidence[c.id] != null).map((c) => c.id)),
    [cards, confidence]
  );
  const covered = coveredIds.size;

  const queueIds = useMemo(() => orderPractice(cards, confidence), [cards, confidence]);

  const card: Flashcard | undefined = useMemo(() => {
    if (currentId) {
      const byId = cards.find((c) => c.id === currentId);
      if (byId) return byId;
    }
    // Default: first card in least-confident-first order.
    const first = queueIds[0];
    return cards.find((c) => c.id === first) ?? cards[0];
  }, [cards, currentId, queueIds]);

  const pickNextUnrated = (conf: Record<string, number>): string | null => {
    const ranked = orderPractice(cards, conf);
    for (const id of ranked) {
      if (conf[id] == null && cards.some((c) => c.id === id)) return id;
    }
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    api
      .practiceProgress(kitId)
      .then((p) => {
        if (cancelled) return;
        const conf = p.confidence ?? {};
        setConfidence(conf);
        const next = pickNextUnrated(conf);
        if (next) {
          setCurrentId(next);
          setSessionDone(false);
        } else if (cards.length > 0) {
          setSessionDone(true);
        }
      })
      .catch(() => {
        /* offline-tolerant: start fresh */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitId, cards.length]);

  // External focus (Weak spots "More") - open that card in the runner.
  const [seenFocus, setSeenFocus] = useState<string | null>(null);
  if (
    focusCardId &&
    focusCardId !== seenFocus &&
    cards.some((c) => c.id === focusCardId)
  ) {
    setSeenFocus(focusCardId);
    setCurrentId(focusCardId);
    setRevealed(false);
    setSessionDone(false);
  }

  useEffect(() => {
    if (!focusCardId || focusCardId === seenFocus) return;
    // after focus applied, scroll the runner into view
    const el = document.getElementById("flashcard-runner");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusCardId, seenFocus]);

  const moveBy = (delta: number) => {
    if (!card || sessionDone) return;
    const i = queueIds.indexOf(card.id);
    const j = Math.min(queueIds.length - 1, Math.max(0, i + delta));
    const next = queueIds[j];
    if (next && next !== card.id) {
      setCurrentId(next);
      setRevealed(false);
    }
  };

  const rate = async (c: number) => {
    if (!card || sessionDone) return;
    const nextConf = { ...confidence, [card.id]: c };
    setConfidence(nextConf);

    const nextUnrated = pickNextUnrated(nextConf);
    if (nextUnrated) {
      setCurrentId(nextUnrated);
      setRevealed(false);
      setSessionDone(false);
    } else {
      setSessionDone(true);
      setRevealed(false);
      setCurrentId(null);
    }
    try {
      await api.recordPractice(kitId, card.id, c);
    } catch {
      /* keep local confidence even if POST fails */
    }
    // Refresh Weak spots only after the server has the new rating.
    onRated?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (sessionDone) return;
      if (e.key === "ArrowRight") moveBy(1);
      if (e.key === "ArrowLeft") moveBy(-1);
      if (e.key === " " || e.key === "Enter") {
        // Do not hijack Enter/Space on interactive controls (buttons/links) -
        // the browser already activates them; stealing would double-fire.
        const interactive =
          tag === "BUTTON" ||
          tag === "A" ||
          tag === "SUMMARY" ||
          el?.isContentEditable ||
          el?.getAttribute("role") === "button";
        if (interactive) return;
        e.preventDefault();
        setRevealed((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!cards.length)
    return (
      <EmptyState
        title="No flashcards yet"
        body="Flashcards are derived from the must-have requirements - generate a kit first, then come back to drill."
      />
    );

  const pct = (covered / Math.max(1, cards.length)) * 100;
  // Stable deck position (not queue order) so the card number doesn't reset to 1 after every rating.
  const pos = card ? cards.findIndex((c) => c.id === card.id) : 0;

  if (sessionDone) {
    return (
      <section
        id="flashcard-runner"
        className="card bg-paper text-center"
        aria-label="Session complete"
        role="status"
      >
        <p className="eyebrow">Session complete</p>
        <h2 className="prose-display mt-3 text-3xl sm:text-4xl">All {cards.length} cards done</h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-pebble">
          You rated every card. Weak spots below are your revision queue - come back tomorrow and
          drill the shaky ones first.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              setConfidence({});
              setSessionDone(false);
              setRevealed(false);
              setCurrentId(cards[0]?.id ?? null);
            }}
          >
            Review again
          </Button>
        </div>
      </section>
    );
  }

  if (!card)
    return (
      <EmptyState
        title="No flashcards yet"
        body="Flashcards are derived from the must-have requirements - generate a kit first, then come back to drill."
      />
    );

  return (
    <section id="flashcard-runner" className="card bg-paper" aria-label="Flashcard runner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow" data-testid="runner-header">
          Card {Math.max(0, pos) + 1} / {cards.length} · covered {covered}/{cards.length}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-wider text-ash">
          ←/→ navigate · space reveal
        </p>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-flint">
        <div
          className="h-full rounded-full bg-charcoal transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-8 min-h-[140px]">
        <h3 className="prose-display text-2xl leading-snug sm:text-3xl" data-testid="card-front">
          {card.front}
        </h3>
        {revealed ? (
          <p className="mt-5 whitespace-pre-wrap border-t border-flint pt-5 text-[15px] leading-relaxed text-graphite">
            {card.back}
          </p>
        ) : (
          <Button className="mt-5" variant="outline" onClick={() => setRevealed(true)}>
            Reveal answer
          </Button>
        )}
      </div>

      <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Rate your confidence">
        {RATINGS.map((r) => (
          <button
            key={r.c}
            className={`btn ${r.cls}`}
            onClick={() => void rate(r.c)}
            disabled={!revealed}
            title={revealed ? undefined : "Reveal the answer first"}
          >
            {r.label}
          </button>
        ))}
      </div>
      {!revealed && (
        <p className="mt-2 font-mono text-[11px] text-ash">Reveal the answer to rate it</p>
      )}
      {covered === cards.length - 1 && (
        <p className="mt-3 font-mono text-[11px] text-success">
          Last card - rate it to finish the session.
        </p>
      )}
    </section>
  );
}
