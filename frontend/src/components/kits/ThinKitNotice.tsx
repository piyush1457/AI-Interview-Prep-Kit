export default function ThinKitNotice({ reqCount }: { reqCount: number }) {
  return (
    <div className="card border-warning bg-paper" role="status">
      <p className="eyebrow text-warning">Thin input · {reqCount} requirement{reqCount === 1 ? "" : "s"} found</p>
      <p className="mt-2 text-sm text-graphite">
        The job description looks short, so the kit is intentionally limited — we&apos;d rather ship an
        honest outline than invent details. Paste a fuller posting and generate again for deeper
        coverage.
      </p>
    </div>
  );
}
