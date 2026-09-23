"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import FlashcardRunner from "@/components/practice/FlashcardRunner";
import WeakSpots from "@/components/practice/WeakSpots";

export default function PracticePage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [doc, setDoc] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.getKit(id).then(setDoc).catch((e: any) => setErr(e.message)); }, [id]);
  if (err) return <div className="p-8 text-red-600">{err}</div>;
  if (!doc) return <div className="p-8">Loading…</div>;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <div className="flex items-center justify-between print-hide">
        <Link href={`/kits/${id}`} className="text-sm underline">← Builder</Link>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => window.print()}>Print one-pager</button>
      </div>
      <h1 className="text-2xl font-bold">Practice — {doc.kit?.role?.title}</h1>
      <FlashcardRunner kitId={id} cards={doc.kit?.flashcards || []} />
      <WeakSpots kitId={id} />
    </div>
  );
}
