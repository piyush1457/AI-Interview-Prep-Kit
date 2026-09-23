import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { createAuthLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const r = Router();
const limiter = createAuthLimiter();

r.post("/register", limiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ code: "VALIDATION", message: "email and password required" });
  if (String(password).length < 6) return res.status(400).json({ code: "VALIDATION", message: "password too short" });
  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) return res.status(409).json({ code: "VALIDATION", message: "email already registered" });
  const hash = await bcrypt.hash(String(password), 10);
  const user = await User.create({ email: String(email).toLowerCase().trim(), passwordHash: hash });
  // Session fixation: rotate the session id before binding an authenticated user.
  await new Promise<void>((resolve, reject) => {
    (req.session as any).regenerate((err: unknown) => (err ? reject(err) : resolve()));
  });
  (req.session as any).userId = String(user._id);
  res.json({ id: String(user._id), email: user.email });
}));

r.post("/login", limiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash)))
    return res.status(401).json({ code: "AUTH", message: "invalid credentials" });
  // Session fixation: rotate before binding the authenticated identity.
  await new Promise<void>((resolve, reject) => {
    (req.session as any).regenerate((err: unknown) => (err ? reject(err) : resolve()));
  });
  (req.session as any).userId = String(user._id);
  res.json({ id: String(user._id), email: user.email });
}));

r.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

r.get("/me", (req, res) => {
  const uid = (req.session as any)?.userId;
  if (!uid) return res.status(401).json({ code: "AUTH", message: "Unauthorized" });
  res.json({ userId: uid });
});

export default r;
