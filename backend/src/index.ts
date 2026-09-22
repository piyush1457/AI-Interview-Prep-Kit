import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDb } from "./db.js";
import { buildSession } from "./middleware/session.js";
import authRoutes from "./routes/auth.js";

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
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me-32chars";
app.use(buildSession(MONGODB_URI, SESSION_SECRET));

app.get("/api/health", (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
app.use("/api/auth", authRoutes);

// stub kits route for Phase 0 so FE can proxy
app.get("/api/kits", (_req, res) => res.json([]));

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ code: "SCHEMA_INVALID", message: err?.message || "Internal error" });
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
