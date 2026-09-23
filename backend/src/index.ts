import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDb } from "./db.js";
import { buildSession } from "./middleware/session.js";
import authRoutes from "./routes/auth.js";
import kitsRoutes from "./routes/kits.js";
import kitsBatchRoutes from "./routes/kitsBatch.js";
import regenRoutes from "./routes/regen.js";
import practiceRoutes from "./routes/practice.js";
import weakSpotsRoutes from "./routes/weakSpots.js";
import { createKitLimiter } from "./middleware/rateLimit.js";

const app = express();
app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-prep-kit";
// Never fall back to a public secret in production (session forgery risk).
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("SESSION_SECRET is required in production");
      })()
    : "dev-secret-change-me-32chars");
app.use(buildSession(MONGODB_URI, SESSION_SECRET));

// One shared limiter for kit mutations (create/batch/regen/PATCH) so routers
// mounted on /api/kits do not each double-count the same request.
const kitLimiter = createKitLimiter();
app.use("/api/kits", (req, res, next) => {
  if (req.method === "POST" || req.method === "PATCH") kitLimiter(req, res, next);
  else next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.use("/api/auth", authRoutes);
app.use("/api/kits", kitsBatchRoutes);
app.use("/api/kits", regenRoutes);
app.use("/api/kits", practiceRoutes);
app.use("/api/kits", weakSpotsRoutes);
app.use("/api/kits", kitsRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  if (res.headersSent) return;
  // Map known failure modes to honest codes/status instead of blanket SCHEMA_INVALID.
  if (err?.name === "CastError") {
    return res.status(404).json({ code: "VALIDATION", message: "not found" });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ code: "VALIDATION", message: "invalid JSON body" });
  }
  const code = typeof err?.code === "string" && err.code ? err.code : "SCHEMA_INVALID";
  const status =
    Number.isInteger(err?.status) && err.status >= 400 && err.status < 600
      ? err.status
      : code === "VALIDATION" || code === "AUTH" || code === "JD_TOO_THIN"
        ? 400
        : 500;
  res.status(status).json({ code, message: err?.message || "Internal error" });
});

process.on("unhandledRejection", (e: any) => {
  console.error("[unhandledRejection]", e?.message || e);
});

const PORT = Number(process.env.PORT || 4000);
if (process.env.NODE_ENV !== "test") {
  connectDb(MONGODB_URI)
    .then(() => app.listen(PORT, () => console.log(`[backend] http://localhost:${PORT} proxy trusted`)))
    .catch((e) => {
      console.error("[db] failed, starting without db for scaffold:", e.message);
      app.listen(PORT, () => console.log(`[backend] http://localhost:${PORT} (no db)`));
    });
}

export default app;
