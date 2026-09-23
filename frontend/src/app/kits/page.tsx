"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { KitEnvelope } from "@/lib/types";
import AppShell from "@/components/organisms/AppShell";
import Button from "@/components/atoms/Button";
import Field from "@/components/atoms/Field";
import Badge from "@/components/atoms/Badge";
import EmptyState from "@/components/atoms/EmptyState";
import Spinner from "@/components/atoms/Spinner";
import BatchUpload from "@/components/kits/BatchUpload";
import type { BadgeTone } from "@/components/atoms/Badge";

const statusTone: Record<string, BadgeTone> = {
  done: "success",
  running: "accent",
  queued: "neutral",
  failed: "danger",
};

function statusLabel(s: string) {
  return s === "done" ? "ready" : s;
}

function formatCreated(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : "Request failed - try again.";
}

function KitsContent() {
  const router = useRouter();
  const [kits, setKits] = useState<KitEnvelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [jd, setJd] = useState("");
  const [url, setUrl] = useState("");
  const [days, setDays] = useState(5);
  const [errMsg, setErrMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [creating, setCreating] = useState(false);
  const jdRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      setKits(await api.listKits());
      setErrMsg("");
    } catch (e: unknown) {
      setErrMsg(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.listKits();
        if (active) {
          setKits(data);
          setErrMsg("");
        }
      } catch (e: unknown) {
        if (active) setErrMsg(errText(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrMsg("");
    try {
      const r = await api.createKit(jd, url, days);
      router.push(`/kits/${r.kitId}`);
    } catch (err: unknown) {
      setErrMsg(errText(err));
      setCreating(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="prose-display mt-1 text-4xl sm:text-5xl">Your kits</h1>
        </div>
        <Button variant="outline" onClick={() => jdRef.current?.focus()}>
          + New kit
        </Button>
      </div>

      <section className="card mt-8" aria-label="Create kit">
        <p className="eyebrow">01 · New kit</p>
        <form onSubmit={create} className="mt-4">
          <Field label="Job description" hint="Paste the full posting - skills, seniority, responsibilities.">
            {(id) => (
              <textarea
                id={id}
                ref={jdRef}
                className="textarea"
                rows={6}
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="We are hiring a Senior Backend Engineer with 5+ years of Go…"
                required
              />
            )}
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field label="Company website">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://company.com"
                  required
                />
              )}
            </Field>
            <Field label="Days available">
              {(id) => (
                <input
                  id={id}
                  className="input"
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  required
                />
              )}
            </Field>
          </div>
          {errMsg && (
            <p className="mt-4 text-sm text-danger" role="alert">
              {errMsg}
            </p>
          )}
          {infoMsg && (
            <p className="mt-4 text-sm text-charcoal" role="status">
              {infoMsg}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button type="submit" pending={creating} disabled={!jd.trim() || !url.trim()}>
              Generate kit
            </Button>
            <span className="font-mono text-[11px] text-pebble">
              ~90s · research + questions + schedule
            </span>
          </div>
        </form>
      </section>

      <div className="mt-6">
        <BatchUpload
          onDone={(ids) => {
            setErrMsg("");
            setInfoMsg(`Queued ${ids.length} kits.`);
            void load();
          }}
        />
      </div>

      <section className="mt-10" aria-label="Existing kits">
        <p className="eyebrow">02 · Library</p>
        {loading ? (
          <div className="mt-4">
            <Spinner label="Loading kits…" />
          </div>
        ) : kits.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No kits yet"
              body={
                <>
                  Paste a job description above and we&apos;ll build a research-backed prep kit -
                  question banks, flashcards and a schedule sized to your deadline.
                </>
              }
              action={
                <Button onClick={() => jdRef.current?.focus()}>Start with a job description</Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {kits.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/kits/${k.id}`}
                  className="card flex flex-wrap items-center justify-between gap-4 transition-colors hover:bg-paper"
                >
                  <div className="min-w-0">
                    <h2 className="prose-display truncate text-xl">
                      {k.kit?.role?.title || "Untitled role"}
                      {k.kit?.source?.company && (
                        <span className="font-sans text-base font-normal text-pebble">
                          {" "}
                          @ {k.kit.source.company}
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ash">
                      {k.kit?.schedule?.days_available ?? k.days ?? "?"} days
                      {k.created_at ? ` · ${formatCreated(k.created_at)}` : ""} · {k.id.slice(-6)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={statusTone[k.status] || "neutral"}>{statusLabel(k.status)}</Badge>
                    <span className="text-sm font-medium text-charcoal">Open →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {kits.length > 0 && kits.some((k) => k.status === "failed") && (
          <p className="mt-4 text-sm text-danger" role="alert">
            Some kits failed to generate - open one to see the error.
          </p>
        )}
      </section>
    </>
  );
}

export default function KitsPage() {
  return (
    <AppShell>
      <KitsContent />
    </AppShell>
  );
}
