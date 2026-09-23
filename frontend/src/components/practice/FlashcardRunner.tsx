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

export default function FlashcardRunner({ kitId, cards }: { kitId: string; cards: Flashcard[] }) {
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const queue = useMemo(() => orderPractice(cards, confidence), [cards, confidence]);
  const card: Flashcard | undefined = cards.find((c) => c.id === queue[idx]) ?? cards[0];

  useEffect(() => {
    api
      .practiceProgress(kitId)
      .then((p) => setConfidence(p.confidence ?? {}))
      .catch(() => {
        /* offline-tolerant: start with empty confidence */
      });
  }, [kitId]);

  const next = () => {
    setRevealed(false);
    setIdx((i) => Math.min(queue.length - 1, i + 1));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setRevealed((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rate = async (c: number) => {
    if (!card) return;
    setConfidence((prev) => ({ ...prev, [card.id]: c }));
    try {
      await api.recordPractice(kitId, card.id, c);
    } catch {
      /* keep local confidence even if POST fails */
    }
    next();
  };

  if (!card)
    return (
      <EmptyState
        title="No flashcards yet"
        body="Flashcards are derived from the must-have requirements — generate a kit first, then come back to drill."
      />
    );

  const covered = Object.keys(confidence).length;
  const pct = (covered / Math.max(1, cards.length)) * 100;

  return (
    <section className="card bg-paper" aria-label="Flashcard runner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">
          Card {idx + 1} / {queue.length} · covered {covered}/{cards.length}
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
        <h3 className="prose-display text-2xl leading-snug sm:text-3xl">{card.front}</h3>
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
    </section>
  );
}
