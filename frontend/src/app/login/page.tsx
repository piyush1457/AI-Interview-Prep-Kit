export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Login</h1>
      <p className="mt-2 text-sm text-zinc-600">Phase 1 will wire this to POST /api/auth/login via proxy (SameSite=Lax).</p>
      <form className="mt-6 flex flex-col gap-3">
        <input placeholder="email" className="rounded border p-2" />
        <input placeholder="password" type="password" className="rounded border p-2" />
        <button type="button" className="rounded bg-black py-2 text-white">
          Sign in (stub)
        </button>
      </form>
    </div>
  );
}
