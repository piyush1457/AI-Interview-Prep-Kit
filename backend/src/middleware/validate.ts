import { z } from "zod";
export const validate = (schema: z.ZodSchema) => (req: any, res: any, next: any) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ code: "VALIDATION", message: r.error.message });
  req.body = r.data;
  next();
};
