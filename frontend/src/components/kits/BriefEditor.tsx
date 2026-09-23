"use client";
import { useState } from "react";
import type { BriefSave, CompanyBrief } from "@/lib/types";
import Button from "@/components/atoms/Button";
import Field from "@/components/atoms/Field";

export default function BriefEditor({
  brief,
  onSave,
  regenPending,
}: {
  brief?: CompanyBrief | null;
  onSave: (b: BriefSave) => void;
  regenPending?: boolean;
}) {
  const [summary, setSummary] = useState(brief?.summary || "");
  const [what, setWhat] = useState(brief?.what_they_do || "");
  const [pending, setPending] = useState(false);
  const [seen, setSeen] = useState({
    summary: brief?.summary,
    what: brief?.what_they_do,
  });

  // Adjust local fields during render when the server brief changes (regen/reload).
  if (seen.summary !== brief?.summary || seen.what !== brief?.what_they_do) {
    setSeen({ summary: brief?.summary, what: brief?.what_they_do });
    setSummary(brief?.summary || "");
    setWhat(brief?.what_they_do || "");
  }

  return (
    <section className="card" aria-label="Company brief">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">01 · Company brief</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            data-regen="brief"
            pending={regenPending}
            onClick={() => onSave({ regen: "brief" })}
          >
            {regenPending ? "Regenerating…" : "Regenerate"}
          </Button>
          <Button
            size="sm"
            pending={pending}
            onClick={() => {
              setPending(true);
              onSave({ summary, what_they_do: what, _meta: { origin: "edited" } });
              setTimeout(() => setPending(false), 400);
            }}
          >
            Save brief
          </Button>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <Field label="Summary">
          {(id) => (
            <textarea
              id={id}
              className="textarea"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              aria-label="Summary"
            />
          )}
        </Field>
        <Field label="What they do">
          {(id) => (
            <textarea
              id={id}
              className="textarea"
              rows={2}
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              aria-label="What they do"
            />
          )}
        </Field>
      </div>
      {brief?._meta?.origin === "edited" && (
        <p className="mt-3">
          <span className="badge badge-accent">hand-edited · survives regen</span>
        </p>
      )}
    </section>
  );
}
