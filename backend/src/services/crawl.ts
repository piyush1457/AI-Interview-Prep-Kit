import * as cheerio from "cheerio";
// @ts-ignore robots-parser has no types; CJS factory (url, contents) -> Robots
import robotsParser from "robots-parser";
import { safeFetch } from "./fetch.js";

const UA = "InterviewPrepKit/1.0 (+assessment; respects robots.txt)";
const KEYWORDS = ["career", "hiring", "job", "about", "handbook", "blog", "engineering", "interview", "join", "team", "culture", "values"];

export function scoreLink(href: string, anchor: string): number {
  const s = `${href} ${anchor}`.toLowerCase();
  let score = 0;
  for (const k of KEYWORDS) if (s.includes(k)) score += k === "career" || k === "hiring" || k === "job" ? 3 : 1;
  if (/\/careers|\/jobs|\/hiring|\/about|\/handbook|\/blog|\/engineering/.test(s)) score += 2;
  if (/\.(pdf|zip|png|jpg|mp4|css|js)(\?|$)/.test(s)) score -= 5;
  return score;
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, noscript").remove();
  const text = $("body").length ? $("body").text() : $.root().text();
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 8000);
}

async function robotsAllowed(base: string, target: string): Promise<boolean> {
  try {
    const robotsUrl = new URL("/robots.txt", base).toString();
    const { text } = await safeFetch(robotsUrl, { timeoutMs: 8000, maxBytes: 100_000 });
    const robots: any = (robotsParser as any)(robotsUrl, text);
    return robots.isAllowed(target, UA) !== false;
  } catch {
    return true; // no robots.txt or unreadable -> allow
  }
}

export interface CrawledPage {
  url: string;
  text: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  pages_used: string[];
  notes: string[];
  errors: { url: string; message: string }[];
}

/** Crawl homepage, rank links by keywords (no hard-coded paths), fetch top-N same-origin. */
export async function crawlCompany(
  companyUrl: string,
  opts: { maxPages?: number; crawlBudgetMs?: number; perPageTimeoutMs?: number; maxBytes?: number } = {}
): Promise<CrawlResult> {
  const maxPages = opts.maxPages ?? 5;
  const budgetMs = opts.crawlBudgetMs ?? 60_000;
  const perPage = opts.perPageTimeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const started = Date.now();
  const notes: string[] = [];
  const errors: { url: string; message: string }[] = [];
  const pages: CrawledPage[] = [];

  let home: string;
  try {
    const r = await safeFetch(companyUrl, { timeoutMs: perPage, maxBytes });
    home = r.text;
    pages.push({ url: r.finalUrl, text: htmlToText(home) });
  } catch (e: any) {
    errors.push({ url: companyUrl, message: e?.message || "homepage fetch failed" });
    return { pages, pages_used: [], notes: ["Company site unreachable from homepage."], errors };
  }

  const base = new URL(pages[0].url);
  const $ = cheerio.load(home);
  const candidates: { href: string; score: number }[] = [];
  $("a[href]").each((_, el) => {
    const raw = String($(el).attr("href") || "").trim();
    const anchor = String($(el).text() || "").trim().slice(0, 120);
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
    let abs: string;
    try {
      abs = new URL(raw, base).toString();
    } catch {
      return;
    }
    const u = new URL(abs);
    if (u.origin !== base.origin) return; // same-origin relative links only
    candidates.push({ href: abs.split("#")[0], score: scoreLink(abs, anchor) });
  });

  // dedupe + sort by score desc
  const seen = new Set<string>(pages.map((p) => p.url));
  const ranked = candidates
    .filter((c) => !seen.has(c.href) && (seen.add(c.href), true))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages);

  for (const c of ranked) {
    if (Date.now() - started > budgetMs) {
      notes.push("Crawl budget exceeded; remaining links skipped.");
      break;
    }
    if (!(await robotsAllowed(base.origin, c.href))) {
      errors.push({ url: c.href, message: "Disallowed by robots.txt" });
      continue;
    }
    try {
      const r = await safeFetch(c.href, { timeoutMs: perPage, maxBytes });
      pages.push({ url: r.finalUrl, text: htmlToText(r.text) });
    } catch (e: any) {
      errors.push({ url: c.href, message: e?.message || "fetch failed" });
    }
  }

  const pages_used = pages.map((p) => p.url);
  const hasHiring = pages.some((p) => /career|hiring|we('| a)re hiring|open roles|join (us|our team)/i.test(p.text));
  if (!hasHiring) notes.push("NO_HIRING_PAGE: site exposes no discoverable hiring page; brief is honest, not fabricated.");
  return { pages, pages_used, notes, errors };
}
