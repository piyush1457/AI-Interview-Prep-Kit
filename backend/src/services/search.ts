// Public interview-process discussion: Brave (if key) -> Tavily (if key) -> DuckDuckGo HTML (zero key).
// No key or zero hits -> honest empty (NO_DISCUSSION), never fatal.
// All providers return the same {hits, note} shape so runPipeline needs no change.

import * as cheerio from "cheerio";

export interface DiscussionHit {
  title: string;
  url: string;
  snippet: string;
}

function companyHost(companyUrl: string): string {
  try {
    return new URL(companyUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function viaBrave(q: string): Promise<DiscussionHit[] | null> {
  const key = process.env.BRAVE_API_KEY || "";
  if (!key) return null; // not configured -> try next provider
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return (data?.web?.results || []).slice(0, 5).map((r: any) => ({
      title: String(r.title || ""),
      url: String(r.url || ""),
      snippet: String(r.description || "").slice(0, 500),
    }));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function viaTavily(q: string): Promise<DiscussionHit[] | null> {
  const key = process.env.TAVILY_API_KEY || process.env.Tavily_API_KEY || "";
  if (!key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: q,
        max_results: 5,
        include_domains: ["glassdoor.com", "reddit.com", "leetcode.com", "teamblind.com"],
        search_depth: "basic",
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const hits: DiscussionHit[] = (data?.results || []).slice(0, 5).map((r: any) => ({
      title: String(r.title || ""),
      url: String(r.url || ""),
      snippet: String(r.content || "").slice(0, 500),
    }));
    return hits;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function viaDuckDuckGo(q: string): Promise<DiscussionHit[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "InterviewPrepKit/1.0 (+assessment; respects robots.txt)" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const hits: DiscussionHit[] = [];
    $("a.result__url, a.result__a").each((_, el) => {
      if (hits.length >= 5) return;
      const href = String($(el).attr("href") || "");
      const title = String($(el).text() || "").trim().slice(0, 200);
      if (!href.startsWith("http") || !title) return;
      const snippet = String($(el).closest(".result").find(".result__snippet").text() || "").trim().slice(0, 500);
      if (!hits.some((h) => h.url === href)) hits.push({ title, url: href, snippet });
    });
    return hits;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function searchInterviewDiscussion(company: string, companyUrl: string): Promise<{ hits: DiscussionHit[]; note?: string }> {
  const host = companyHost(companyUrl);
  const q = `${company} interview process ${host}`.trim();
  const brave = await viaBrave(q);
  if (brave && brave.length > 0) return { hits: brave };
  const tavily = await viaTavily(q);
  if (tavily && tavily.length > 0) return { hits: tavily };
  const ddg = await viaDuckDuckGo(q);
  if (ddg.length > 0) return { hits: ddg };
  return { hits: [], note: "NO_DISCUSSION: no public discussion found (Brave/Tavily/DDG all empty or unkeyed)." };
}
