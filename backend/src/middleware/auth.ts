import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/utils.js";

declare global {
  namespace Express {
    interface Request {
      user?: any;
      admin?: any;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = decoded;
  next();
}