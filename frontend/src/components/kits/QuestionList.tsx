"use client";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Question } from "@/lib/types";
import { markEdited, moveQuestionCategory } from "@/lib/kitState";
import Button from "@/components/atoms/Button";

const CATS = ["technical", "behavioural", "system-design", "company-fit"];

function Card({
  q,
  onEdit,
  onMove,
  onDelete,
}: {
  q: Question;
  onEdit: (q: Question) => void;
  onMove: (q: Question, cat: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: q.id });
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [outline, setOutline] = useState(q.answer_outline || "");
  const style = { transform: CSS.Transform.toString(transform), transition };
  const edited = q._meta?.origin !== "generated";

  return (
    <li ref={setNodeRef} style={style} className="card-paper flex items-start gap-3">
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag question ${q.id} to reorder`}
        title="Drag to reorder (keyboard: Space + arrows)"
        className="mt-0.5 cursor-grab px-1 text-ash hover:text-charcoal"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              className="input"
              aria-label="Question prompt"
            />
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              rows={2}
              className="input mt-2"
              aria-label="Answer outline"
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onEdit(markEdited({ ...q, prompt, answer_outline: outline }));
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
            <p className="text-[15px] font-medium leading-snug text-charcoal">{q.prompt}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-pebble">{q.answer_outline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge">d{q.difficulty}</span>
              <span className="badge">{(q.requirement_ids ?? []).join(", ")}</span>
              {edited && <span className="badge badge-accent">hand-edited · survives regen</span>}
              <span className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <label className="sr-only" htmlFor={`move-${q.id}`}>
                  Move to category
                </label>
                <select
                  id={`move-${q.id}`}
                  value={q.category}
                  onChange={(e) => onMove(moveQuestionCategory(q, e.target.value), e.target.value)}
                  className="select w-auto py-1 text-xs"
                >
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="danger" onClick={() => onDelete(q.id)}>
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

export default function QuestionList({
  category,
  eyebrow,
  questions,
  onReorder,
  onEdit,
  onMove,
  onDelete,
  onAdd,
  onRegen,
  regenPending,
}: {
  category: string;
  eyebrow?: string;
  questions: Question[];
  onReorder: (ids: string[]) => void;
  onEdit: (q: Question) => void;
  onMove: (q: Question) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onRegen: () => void;
  regenPending?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  return (
    <section className="card" aria-label={`${category} questions`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">
          {eyebrow || category} <span className="text-ash">· {questions.length}</span>
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onAdd}>
            + Add
          </Button>
          <Button size="sm" variant="outline" pending={regenPending} onClick={onRegen}>
            {regenPending ? "Regenerating…" : "Regenerate category"}
          </Button>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e;
          if (over && active.id !== over.id) {
            const ids = questions.map((q) => q.id);
            onReorder(
              arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
            );
          }
        }}
      >
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-4 flex flex-col gap-2">
            {questions.length === 0 && (
              <li className="py-3 text-sm text-ash">
                No questions in this category yet - add one or regenerate.
              </li>
            )}
            {questions.map((q) => (
              <Card
                key={q.id}
                q={q}
                onEdit={onEdit}
                onMove={(qq) => onMove(qq)}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}
