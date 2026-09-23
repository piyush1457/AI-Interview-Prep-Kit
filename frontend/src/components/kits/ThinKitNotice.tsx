export default function ThinKitNotice({ reqCount }: { reqCount: number }) {
  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm" role="note">
      <strong>Thin kit, on purpose.</strong> The description yielded only {reqCount} requirement(s),
      so this kit is intentionally thin rather than fabricated. Add details to the posting or edit below.
    </div>
  );
}
