"use client";
import { useState } from "react";
import type { Flashcard } from "@/lib/types";
import { markEdited } from "@/lib/kitState";
import Button from "@/components/atoms/Button";

function Card({
  card,
  onEdit,
  onDelete,
}: {
  card: Flashcard;
  onEdit: (c: Flashcard) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back || "");
  const edited = card._meta?.origin === "edited" || card._meta?.origin === "pinned";

  return (
    <li className="card-paper flex items-start gap-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              rows={2}
              className="input"
              aria-label="Flashcard front"
              placeholder="Front (prompt)"
            />
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              rows={2}
              className="input mt-2"
              aria-label="Flashcard back"
              placeholder="Back (answer)"
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onEdit(
                    markEdited({
                      ...card,
                      front: front.trim() || card.front,
                      back: back.trim(),
                    })
                  );
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[15px] font-medium leading-snug text-charcoal">{card.front}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-pebble">{card.back}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge">{(card.requirement_ids ?? []).join(", ") || "-"}</span>
              {edited && <span className="badge badge-accent">hand-edited</span>}
              <span className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(card.id)}>
                  Delete
                </Button>
              </span>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

export default function FlashcardList({
  cards,
  onEdit,
  onDelete,
  onAdd,
}: {
  cards: Flashcard[];
  onEdit: (c: Flashcard) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="card" aria-label="Flashcards">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">
          07 · Flashcards <span className="text-ash">· {cards.length}</span>
        </p>
        <Button size="sm" variant="outline" onClick={onAdd}>
          + Add flashcard
        </Button>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {cards.length === 0 && (
          <li className="py-3 text-sm text-ash">No flashcards yet - add one by hand.</li>
        )}
        {cards.map((c) => (
          <Card key={c.id} card={c} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}
