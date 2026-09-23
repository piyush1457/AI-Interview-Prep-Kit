import Link from "next/link";

const FEATURES = [
  {
    n: "01",
    title: "Research",
    body: "We crawl the company site, pull hiring pages and public discussion, then distil an honest company brief — no fabrication when sources are thin.",
  },
  {
    n: "02",
    title: "Generate",
    body: "Requirements extracted from your JD become four categorised question banks — technical, behavioural, system design, company fit — with answer outlines.",
  },
  {
    n: "03",
    title: "Practice",
    body: "Flashcards, a day-by-day schedule sized to your timeline, and a weak-spots report that queues what you rated shaky.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-flint bg-marble">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
          <span className="prose-display text-xl tracking-tight">PrepKit</span>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6">
        <section className="py-20 sm:py-28">
          <p className="eyebrow">AI Interview Prep Kit</p>
          <h1 className="prose-display mt-5 max-w-[16ch] text-5xl leading-[1.02] sm:text-7xl sm:leading-[1] sm:tracking-[-0.02em] lg:text-8xl">
            Turn any job post into a <span className="wash">five-day</span> interview plan.
          </h1>
          <p className="mt-6 max-w-[600px] text-lg text-pebble">
            Paste a job description and a company URL. Get research, a question bank you can
            edit, flashcards and a schedule that fits the days you actually have.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn btn-primary">
              Get started — it&apos;s free
            </Link>
            <Link href="/login" className="btn btn-outline">
              I have an account
            </Link>
          </div>
        </section>

        <section aria-label="How it works" className="grid gap-6 pb-20 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.n} className="card">
              <p className="eyebrow">
                {f.n} · {f.title}
              </p>
              <h2 className="prose-display mt-3 text-xl">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-graphite">{f.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-flint bg-marble">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ash">
            Built with Groq · Next.js · Express · MongoDB — FS-AI-INTERVIEW-01
          </p>
        </div>
      </footer>
    </div>
  );
}
