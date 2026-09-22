import type { Request, Response, NextFunction } from "express";
import { ErrorCode } from "@ai-prep/kit-schema";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ code: ErrorCode.AUTH, message: "Unauthorized" });
  (req as any).userId = userId;
  next();
}
