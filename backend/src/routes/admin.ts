import { Router } from "express";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import { query } from "../db.js";
import { signToken, generateId, comparePassword } from "../lib/utils.js";

const router = Router();

router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const admins = await query(`SELECT * FROM admins WHERE email = ?`, [email]);
    if (!admins || admins.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    const admin = admins[0] as any;
    const valid = await comparePassword(password, admin.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken({ id: admin.id, name: admin.name, email: admin.email, isAdmin: true });
    res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) { res.status(500).json({ error: "Admin login failed" }); }
});

router.get("/admin/me", authenticateAdmin, (req, res) => res.json(req.admin));

router.get("/admin/businesses", authenticateAdmin, async (req, res) => {
  const { search, tier, status, sort, order = 'DESC', limit = 50, offset = 0 } = req.query;
  let where = 'WHERE 1=1'; const params: any[] = [];
  if (search) { const p = `%${search}%`; where += ` AND (b.name LIKE ? OR b.email LIKE ? OR u.email LIKE ?)`; params.push(p, p, p); }
  if (tier) { where += ` AND b.tier = ?`; params.push(tier); }
  if (status) { where += ` AND b.stripe_subscription_status = ?`; params.push(status); }
  let orderBy = 'ORDER BY b.created_at';
  if (sort && typeof sort === 'string') orderBy = `ORDER BY b.${sort.replace(/[^a-zA-Z0-9_]/g, '')}`;
  orderBy += ` ${order === 'ASC' ? 'ASC' : 'DESC'}`;
  try {
    const data = await query(
      `SELECT b.*, u.email as user_email, u.name as user_name, (SELECT COUNT(*) FROM posts WHERE business_id = b.id) as post_count, (SELECT COUNT(*) FROM bookings WHERE business_id = b.id) as booking_count, (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as review_count FROM businesses b LEFT JOIN users u ON u.business_id = b.id ${where} ${orderBy} LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const total = await query(`SELECT COUNT(*) as count FROM businesses b LEFT JOIN users u ON u.business_id = b.id ${where}`, params.length > 0 ? params : undefined);
    res.json({ businesses: data, total: (total as any[])[0].count });
  } catch (err) { console.error("Admin fetch businesses error:", err); res.status(500).json({ error: "Failed to fetch businesses" }); }
});

router.get("/admin/businesses/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const biz = await query(`SELECT * FROM businesses WHERE id = ?`, [id]);
    if (!biz || biz.length === 0) return res.status(404).json({ error: "Business not found" });
    const user = await query(`SELECT id, name, email, created_at FROM users WHERE business_id = ?`, [id]);
    const connections = await query(`SELECT platform, connected, username FROM social_connections WHERE business_id = ?`, [id]);
    const usage = await query(`SELECT feature, count_used, limit_amount FROM subscription_usage WHERE business_id = ?`, [id]);
    const bookings = await query(`SELECT * FROM bookings WHERE business_id = ? ORDER BY created_at DESC LIMIT 5`, [id]);
    res.json({ ...(biz[0] as any), user: (user as any)?.[0], social_connections: connections, usage, recent_bookings: bookings });
  } catch (err) { res.status(500).json({ error: "Failed to fetch business details" }); }
});

router.patch("/admin/businesses/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const allowed = ['name', 'phone', 'email', 'address', 'website', 'category', 'description', 'target_areas'];
  const sets: string[] = []; const params: any[] = [];
  for (const key of Object.keys(updates)) { if (allowed.includes(key)) { sets.push(`${key} = ?`); params.push(updates[key]); } }
  if (sets.length === 0) return res.status(400).json({ error: "No valid updates provided" });
  params.push(id);
  try { await query(`UPDATE businesses SET ${sets.join(', ')} WHERE id = ?`, params); res.json({ message: "Business updated" }); }
  catch (err) { res.status(500).json({ error: "Update failed" }); }
});

router.patch("/admin/businesses/:id/plan", authenticateAdmin, async (req, res) => {
  const { id } = req.params; const { tier } = req.body;
  if (!tier) return res.status(400).json({ error: "Tier required" });
  try { await query(`UPDATE businesses SET tier = ? WHERE id = ?`, [tier, id]); res.json({ message: `Plan updated to ${tier}` }); }
  catch (err) { res.status(500).json({ error: "Plan update failed" }); }
});

router.patch("/admin/businesses/:id/status", authenticateAdmin, async (req, res) => {
  const { id } = req.params; const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status required" });
  try { await query(`UPDATE businesses SET stripe_subscription_status = ? WHERE id = ?`, [status, id]); res.json({ message: `Status updated to ${status}` }); }
  catch (err) { res.status(500).json({ error: "Status update failed" }); }
});

router.delete("/admin/businesses/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try { await query(`DELETE FROM users WHERE business_id = ?`, [id]); await query(`DELETE FROM posts WHERE business_id = ?`, [id]); await query(`DELETE FROM bookings WHERE business_id = ?`, [id]); await query(`DELETE FROM businesses WHERE id = ?`, [id]); res.json({ message: "Business deleted" }); }
  catch (err) { res.status(500).json({ error: "Deletion failed" }); }
});

router.post("/admin/businesses/:id/refund", authenticateAdmin, async (req, res) => {
  const { amount, reason } = req.body;
  res.json({ message: "Refund processed (Mock mode)", amount, reason });
});

router.get("/admin/revenue/overview", authenticateAdmin, async (req, res) => {
  try {
    const stats = await query(`SELECT SUM(CASE WHEN stripe_subscription_status = 'active' THEN (CASE WHEN tier = 'Starter' THEN 149.99 WHEN tier = 'Pro' THEN 499.99 WHEN tier = 'Premium' THEN 999.99 ELSE 0 END) ELSE 0 END) as mrr, COUNT(CASE WHEN stripe_subscription_status = 'active' THEN 1 END) as active_subscribers FROM businesses`);
    const { mrr = 0, active_subscribers = 0 } = (stats[0] as any);
    res.json({ mrr, active_subscribers, churn_rate: 2.5, arpu: active_subscribers > 0 ? mrr / active_subscribers : 0 });
  } catch (err) { res.status(500).json({ error: "Revenue data failed" }); }
});

router.get("/admin/revenue/by-tier", authenticateAdmin, async (req, res) => {
  try {
    const data = await query(`SELECT tier, COUNT(*) as count, SUM(CASE WHEN tier = 'Starter' THEN 149.99 WHEN tier = 'Pro' THEN 499.99 WHEN tier = 'Premium' THEN 999.99 ELSE 0 END) as revenue FROM businesses WHERE stripe_subscription_status = 'active' GROUP BY tier`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: "Revenue by tier failed" }); }
});

router.get("/admin/revenue/trends", authenticateAdmin, async (req, res) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  res.json(months.map((m, i) => ({ month: m, revenue: 1000 + i * 500 + Math.random() * 200 })));
});

router.get("/admin/revenue/transactions", authenticateAdmin, async (req, res) => {
  try { const data = await query(`SELECT * FROM platform_transactions ORDER BY created_at DESC LIMIT 100`); res.json(data); }
  catch (err) { res.status(500).json({ error: "Transactions fetch failed" }); }
});

router.get("/admin/tickets", authenticateAdmin, async (req, res) => {
  const { status, priority } = req.query;
  let where = 'WHERE 1=1'; const params: any[] = [];
  if (status) { where += ` AND t.status = ?`; params.push(status); }
  if (priority) { where += ` AND t.priority = ?`; params.push(priority); }
  try {
    const data = await query(`SELECT t.*, b.name as business_name, u.email as user_email FROM support_tickets t LEFT JOIN users u ON t.user_id = u.id LEFT JOIN businesses b ON u.business_id = b.id ${where} ORDER BY t.created_at DESC`, params.length > 0 ? params : undefined);
    res.json(data);
  } catch (err) { res.status(500).json({ error: "Tickets fetch failed" }); }
});

router.get("/admin/tickets/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await query(`SELECT t.*, b.name as business_name, u.email as user_email FROM support_tickets t LEFT JOIN users u ON t.user_id = u.id LEFT JOIN businesses b ON u.business_id = b.id WHERE t.id = ?`, [id]);
    if (!ticket || ticket.length === 0) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket[0]);
  } catch (err) { res.status(500).json({ error: "Ticket detail failed" }); }
});

router.patch("/admin/tickets/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params; const { status, priority, assigned_to } = req.body;
  const sets: string[] = []; const params: any[] = [];
  if (status) { sets.push("status = ?"); params.push(status); }
  if (priority) { sets.push("priority = ?"); params.push(priority); }
  if (assigned_to) { sets.push("assigned_to = ?"); params.push(assigned_to); }
  if (sets.length === 0) return res.status(400).json({ error: "No updates provided" });
  params.push(id);
  try { await query(`UPDATE support_tickets SET ${sets.join(', ')} WHERE id = ?`, params); res.json({ message: "Ticket updated" }); }
  catch (err) { res.status(500).json({ error: "Ticket update failed" }); }
});

router.post("/admin/tickets/:id/reply", authenticateAdmin, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });
  res.json({ message: "Reply sent (stub)" });
});

router.get("/admin/stats", authenticateAdmin, async (req, res) => {
  try {
    const counts = await query(`SELECT (SELECT COUNT(*) FROM businesses) as total_businesses, (SELECT COUNT(*) FROM posts) as total_posts, (SELECT COUNT(*) FROM reviews) as total_reviews, (SELECT COUNT(*) FROM bookings) as total_bookings, (SELECT COUNT(*) FROM businesses WHERE created_at >= date('now', '-30 days')) as signups_month`);
    res.json((counts[0] as any));
  } catch (err) { res.status(500).json({ error: "Stats failed" }); }
});

export default router;