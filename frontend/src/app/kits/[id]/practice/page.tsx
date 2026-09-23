"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Flashcard, KitEnvelope } from "@/lib/types";
import AppShell from "@/components/organisms/AppShell";
import Spinner from "@/components/atoms/Spinner";
import FlashcardRunner from "@/components/practice/FlashcardRunner";
import WeakSpots from "@/components/practice/WeakSpots";

function PracticeContent({ id }: { id: string }) {
  const [doc, setDoc] = useState<KitEnvelope | null>(null);
  const [err, setErr] = useState("");
  const [spotsRev, setSpotsRev] = useState(0);
  const [focusCardId, setFocusCardId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api
      .getKit(id)
      .then((k) => {
        if (active) setDoc(k);
      })
      .catch((e: unknown) => {
        if (active) setErr(e instanceof Error ? e.message : "Failed to load kit.");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (err)
    return (
      <div className="card max-w-lg border-danger bg-paper" role="alert">
        <p className="text-sm text-danger">{err}</p>
        <Link href="/kits" className="btn btn-outline mt-4">
          ← Back to kits
        </Link>
      </div>
    );
  if (!doc)
    return (
      <div className="py-8">
        <Spinner label="Loading practice…" />
      </div>
    );

  const cards: Flashcard[] = doc.kit?.flashcards ?? [];

  return (
    <>
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <Link href={`/kits/${id}`} className="btn btn-ghost btn-sm -ml-3">
          ← Builder
        </Link>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
          Print one-pager
        </button>
      </div>

      <header className="mt-6">
        <p className="eyebrow">Practice mode</p>
        <h1 className="prose-display mt-2 text-4xl sm:text-5xl">
          {doc.kit?.role?.title || "Flashcards"}
        </h1>
        <p className="mt-2 text-pebble">
          Reveal, rate your confidence, and let the weak-spots queue pull the shaky cards forward.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6">
        <FlashcardRunner
          kitId={id}
          cards={cards}
          onRated={() => setSpotsRev((r) => r + 1)}
          focusCardId={focusCardId}
        />
        <WeakSpots
          kitId={id}
          refreshKey={spotsRev}
          onOpenCard={(cardId) => setFocusCardId(cardId)}
        />
      </div>
    </>
  );
}

export default function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <PracticeContent id={id} />
    </AppShell>
  );
}
