// Same-origin API client (Next rewrites /api/* -> Render, first-party cookies).
async function req(path: string, init?: RequestInit & { version?: number }) {
  const { version, ...rest } = init as any || {};
  const headers: any = { "Content-Type": "application/json", ...(rest.headers || {}) };
  if (version != null) headers["If-Match"] = String(version);
  const res = await fetch(path, { ...rest, headers, credentials: "include" });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error(body.message || "Stale version — refetch and re-apply");
    err.code = 409;
    err.kit = body.kit;
    throw err;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => req("/api/auth/me"),
  login: (email: string, password: string) => req("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) => req("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req("/api/auth/logout", { method: "POST" }),
  listKits: () => req("/api/kits"),
  createKit: (jd: string, company_url: string, days: number) =>
    req("/api/kits", { method: "POST", body: JSON.stringify({ jd, company_url, days }) }),
  getKit: (id: string) => req(`/api/kits/${id}`),
  patchKit: (id: string, kit: any, version: number) =>
    req(`/api/kits/${id}`, { method: "PATCH", body: JSON.stringify({ kit }), version }),
  regenerate: (id: string, scope: any, version: number) =>
    req(`/api/kits/${id}/regenerate`, { method: "POST", body: JSON.stringify({ scope }), version }),
  batch: (items: { jd: string; company_url: string; days: number }[]) =>
    req("/api/kits/batch", { method: "POST", body: JSON.stringify({ items }) }),
  recordPractice: (id: string, cardId: string, confidence: number) =>
    req(`/api/kits/${id}/practice`, { method: "POST", body: JSON.stringify({ cardId, confidence }) }),
  practiceProgress: (id: string) => req(`/api/kits/${id}/practice`),
  weakSpots: (id: string) => req(`/api/kits/${id}/weak-spots`),
};
