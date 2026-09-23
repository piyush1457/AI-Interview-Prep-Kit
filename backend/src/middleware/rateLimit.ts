import rateLimit from "express-rate-limit";

export function createAuthLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: "RATE_LIMITED", message: "Too many requests, try again later." },
  });
}

// Caps LLM/crawl cost: kit create, batch, regen share one budget per IP.
export function createKitLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { code: "RATE_LIMITED", message: "Too many kit requests, try again later." },
  });
}
