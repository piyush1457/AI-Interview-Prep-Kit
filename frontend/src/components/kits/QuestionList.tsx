"use client";
import { useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { markEdited, moveQuestionCategory } from "@/lib/kitState";

const CATS = ["technical", "behavioural", "system-design", "company-fit"];

function Card({ q, onEdit, onMove, onDelete }: { q: any; onEdit: (q: any) => void; onMove: (q: any, cat: string) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: q.id });
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(q.prompt);
  const [outline, setOutline] = useState(q.answer_outline);
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li ref={setNodeRef} style={style} className="rounded border bg-white p-3 dark:bg-zinc-900">
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} aria-label={`Drag ${q.id}`} className="cursor-grab px-1 text-zinc-400" title="Drag to reorder (keyboard: Space + arrows)">⋮⋮</button>
        <div className="flex-1">
          {editing ? (
            <>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="w-full rounded border p-2 text-sm" aria-label="Question prompt" />
              <textarea value={outline} onChange={(e) => setOutline(e.target.value)} rows={2} className="mt-2 w-full rounded border p-2 text-sm" aria-label="Answer outline" />
              <div className="mt-2 flex gap-2">
                <button className="rounded bg-black px-3 py-1 text-sm text-white"
                  onClick={() => { onEdit(markEdited({ ...q, prompt, answer_outline: outline })); setEditing(false); }}>Save</button>
                <button className="rounded border px-3 py-1 text-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{q.prompt}</p>
              <p className="mt-1 text-xs text-zinc-500">{q.answer_outline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{q.category} · d{q.difficulty} · {(q.requirement_ids || []).join(",")}</span>
                {q._meta?.origin !== "generated" && <span className="rounded bg-amber-100 px-2 py-0.5">hand-edited (survives regen)</span>}
                <button className="underline" onClick={() => setEditing(true)}>Edit</button>
                <label>Move to
                  <select value={q.category} onChange={(e) => onMove(moveQuestionCategory(q, e.target.value), e.target.value)}
                    className="ml-1 rounded border px-1 py-0.5">
                    {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <button className="text-red-600 underline" onClick={() => onDelete(q.id)}>Delete</button>
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export default function QuestionList({ category, questions, onReorder, onEdit, onMove, onDelete, onAdd, onRegen }:
  { category: string; questions: any[]; onReorder: (ids: string[]) => void; onEdit: (q: any) => void; onMove: (q: any) => void; onDelete: (id: string) => void; onAdd: () => void; onRegen: () => void }) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return (
    <section className="rounded border p-4" aria-label={`${category} questions`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{category} ({questions.length})</h3>
        <div className="flex gap-2">
          <button className="rounded border px-2 py-1 text-xs" onClick={onAdd}>+ Add</button>
          <button className="rounded border px-2 py-1 text-xs" onClick={onRegen}>Regenerate category</button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={(e) => {
          const { active, over } = e;
          if (over && active.id !== over.id) {
            const ids = questions.map((q) => q.id);
            onReorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
          }
        }}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ul className="mt-3 flex flex-col gap-2">
            {questions.map((q) => <Card key={q.id} q={q} onEdit={onEdit} onMove={(qq) => onMove(qq)} onDelete={onDelete} />)}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}
