"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { orderPractice } from "@/lib/kitState";

export default function FlashcardRunner({ kitId, cards }: { kitId: string; cards: any[] }) {
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const queue = useMemo(() => orderPractice(cards, confidence), [cards, confidence]);
  const card = cards.find((c) => c.id === queue[idx]) || cards[0];

  useEffect(() => {
    api.practiceProgress(kitId).then((p: any) => setConfidence(p.confidence || {})).catch(() => {});
  }, [kitId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setRevealed((r) => !r); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const next = () => { setRevealed(false); setIdx((i) => Math.min(queue.length - 1, i + 1)); };

  const rate = async (c: number) => {
    if (!card) return;
    const nextConf = { ...confidence, [card.id]: c };
    setConfidence(nextConf);
    try { await api.recordPractice(kitId, card.id, c); } catch {}
    next();
  };

  if (!card) return <p>No flashcards yet.</p>;
  const covered = Object.keys(confidence).length;
  return (
    <div className="rounded border p-6">
      <div className="flex justify-between text-sm text-zinc-500">
        <span>Card {idx + 1}/{queue.length} · covered {covered}/{cards.length}</span>
        <span>←/→ navigate · Space reveal</span>
      </div>
      <div className="mt-2 h-2 rounded bg-zinc-200">
        <div className="h-full rounded bg-green-600" style={{ width: `${(covered / Math.max(1, cards.length)) * 100}%` }} />
      </div>
      <h3 className="mt-6 text-xl font-semibold">{card.front}</h3>
      {revealed ? (
        <p className="mt-4 whitespace-pre-wrap text-sm">{card.back}</p>
      ) : (
        <button className="mt-4 rounded border px-4 py-2" onClick={() => setRevealed(true)}>Reveal answer</button>
      )}
      <div className="mt-6 flex gap-2" role="group" aria-label="Confidence">
        {[1, 2, 3].map((c) => (
          <button key={c} onClick={() => rate(c)}
            className={`rounded px-4 py-2 text-white ${c === 1 ? "bg-red-600" : c === 2 ? "bg-amber-500" : "bg-green-600"}`}>
            {c === 1 ? "Shaky" : c === 2 ? "OK" : "Solid"}
          </button>
        ))}
      </div>
    </div>
  );
}
