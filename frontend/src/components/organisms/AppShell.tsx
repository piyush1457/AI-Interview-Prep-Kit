"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import Spinner from "@/components/atoms/Spinner";
import { useState } from "react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { userId, checked } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      setLoggingOut(false);
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="print-hide sticky top-0 z-20 border-b border-flint bg-marble">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="prose-display text-xl tracking-tight">
              PrepKit
            </Link>
            <nav aria-label="Primary" className="flex items-center gap-1">
              <Link
                href="/kits"
                className={`btn btn-ghost btn-sm ${pathname?.startsWith("/kits") ? "bg-paper" : ""}`}
              >
                Kits
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {checked ? (
              userId ? (
                <>
                  <span className="badge badge-success hidden sm:inline-flex">signed in</span>
                  <button className="btn btn-ghost btn-sm" onClick={logout} disabled={loggingOut}>
                    {loggingOut ? "Signing out…" : "Log out"}
                  </button>
                </>
              ) : (
                <Link href="/login" className="btn btn-primary btn-sm">
                  Sign in
                </Link>
              )
            ) : (
              <Spinner label="" />
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10">{children}</main>
      <footer className="print-hide border-t border-flint bg-marble">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-5">
          <p className="font-mono text-[11px] uppercase tracking-wider text-ash">
            AI Interview Prep Kit · Groq · Next.js · Express · MongoDB
          </p>
        </div>
      </footer>
    </div>
  );
}
