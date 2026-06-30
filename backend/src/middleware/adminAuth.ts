import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/utils.js";
import { query } from "../db.js";

export async function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const tokenString = authHeader.substring(7);
  const decoded = verifyToken(tokenString);
  if (!decoded || !decoded.isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const admins = await query(`SELECT id FROM admins WHERE id = ?`, [decoded.id]);
    if (!admins || admins.length === 0) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}