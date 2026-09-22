import session from "express-session";
import MongoStore from "connect-mongo";

export function buildSession(uri: string, secret: string) {
  const isProd = process.env.NODE_ENV === "production";
  return session({
    secret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: uri, ttl: 14 * 24 * 60 * 60 }),
    cookie: {
      httpOnly: true,
      sameSite: "lax", // first-party via Next rewrites; no None/3p needed
      secure: isProd,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  });
}
