import { Router } from "express";
import { hashPassword, comparePassword, signToken, generateId } from "../lib/utils.js";
import { query } from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/auth/signup", async (req, res) => {
  const { name, email, password, businessName, category } = req.body;
  if (!name || !email || !password || !businessName || !category) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }
    const userId = generateId();
    const businessId = generateId();
    const hashedPassword = await hashPassword(password);

    await query(`INSERT INTO businesses (id, name, category, tier) VALUES (?, ?, ?, 'Starter')`, [businessId, businessName, category]);
    await query(`INSERT INTO users (id, name, email, password, business_id) VALUES (?, ?, ?, ?, ?)`, [userId, name, email, hashedPassword, businessId]);

    const token = signToken({ userId, email, businessId });
    res.status(201).json({ token, user: { id: userId, name, email }, business: { id: businessId, name: businessName, category, tier: "Starter" } });
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Registration failed. Try again." });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  try {
    const users = await query(
      `SELECT u.id as userId, u.name, u.email, u.password, u.business_id as businessId, b.name as businessName, b.category, b.tier
       FROM users u LEFT JOIN businesses b ON u.business_id = b.id WHERE u.email = ?`, [email]
    );
    if (!users || users.length === 0) return res.status(401).json({ error: "Invalid email or password" });
    const user = users[0] as any;
    const valid = await comparePassword(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const token = signToken({ userId: user.userId, email: user.email, businessId: user.businessId });
    res.json({ token, user: { id: user.userId, name: user.name, email: user.email }, business: { id: user.businessId, name: user.businessName, category: user.category, tier: user.tier } });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

router.get("/user/me", authenticate, async (req, res) => {
  const { userId, businessId } = req.user!;
  try {
    const users = await query(
      `SELECT u.id as userId, u.name, u.email, u.business_id as businessId, b.name as businessName, b.category, b.tier
       FROM users u LEFT JOIN businesses b ON u.business_id = b.id WHERE u.id = ?`, [userId]
    );
    if (!users || users.length === 0) return res.status(404).json({ error: "User not found" });
    const user = users[0] as any;
    res.json({ user: { id: user.userId, name: user.name, email: user.email }, business: { id: user.businessId, name: user.businessName, category: user.category, tier: user.tier } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

export default router;