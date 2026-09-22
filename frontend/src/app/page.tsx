import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <main className="w-full max-w-2xl rounded-2xl bg-white p-10 shadow dark:bg-zinc-900">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">AI Interview Prep Kit</h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Phase 0 scaffold — auth + kit generation pipeline ships in Phase 1.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/kits" className="rounded-full bg-black px-6 py-3 text-white hover:bg-zinc-800">
            Go to Kits
          </Link>
          <Link href="/login" className="rounded-full border px-6 py-3 hover:bg-zinc-50 dark:border-zinc-700">
            Login
          </Link>
        </div>
        <p className="mt-8 text-xs text-zinc-500">API proxied via /api → {process.env.API_URL || "http://localhost:4000"}</p>
      </main>
    </div>
  );
}
