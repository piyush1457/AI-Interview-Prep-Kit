"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

/** Redirects anonymous users to /login?next=<path>; returns userId once known. */
export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((r) => {
        if (cancelled) return;
        setUserId(r.userId);
        setChecked(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          const qs = window.location.search;
          router.replace(`/login?next=${encodeURIComponent(qs ? `${pathname}${qs}` : pathname)}`);
        } else {
          setChecked(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return { userId, checked };
}
