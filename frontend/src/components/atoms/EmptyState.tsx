import type { ReactNode } from "react";

export default function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-start gap-3 text-left" role="status">
      <h2 className="prose-display text-2xl">{title}</h2>
      <p className="max-w-md text-sm text-pebble">{body}</p>
      {action}
    </div>
  );
}
