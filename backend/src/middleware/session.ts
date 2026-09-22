import session from "express-session";
import MongoStore from "connect-mongo";

// Non-fatal store: a bad/unreachable URI must not crash the process.
// Falls back to MemoryStore (health-only mode) and logs instead of throwing.
export function buildSession(uri: string, secret: string) {
  const isProd = process.env.NODE_ENV === "production";
  let store: any = new session.MemoryStore();
  const looksMongo = /^mongodb(\+srv)?:\/\//.test(uri || "");
  if (looksMongo) {
    try {
      const mongoStore = MongoStore.create({ mongoUrl: uri, ttl: 14 * 24 * 60 * 60 });
      mongoStore.on("error", (e: any) => console.error("[session store]", e?.message || e));
      store = mongoStore;
    } catch (e: any) {
      console.error("[session store] create failed, using MemoryStore:", e?.message || e);
    }
  } else {
    console.warn("[session store] no Mongo URI, using MemoryStore (health-only mode)");
  }
  return session({
    secret,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      sameSite: "lax", // first-party via Next rewrites; no None/3p needed
      secure: isProd,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  });
}
