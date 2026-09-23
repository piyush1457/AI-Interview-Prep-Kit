"use client";
import { useId } from "react";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
  htmlFor?: string;
}) {
  const auto = useId();
  const id = htmlFor || auto;
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export default Field;
