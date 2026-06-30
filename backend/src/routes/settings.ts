import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";
import { generateId } from "../lib/utils.js";

const router = Router();

// Business profile update
router.patch("/business/profile", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { name, phone, email, address, website, hours, target_areas, logo_url } = req.body;
  try {
    const sets: string[] = []; const params: any[] = [];
    if (name) { sets.push("name = ?"); params.push(name); }
    if (phone !== undefined) { sets.push("phone = ?"); params.push(phone || null); }
    if (email !== undefined) { sets.push("email = ?"); params.push(email || null); }
    if (address !== undefined) { sets.push("address = ?"); params.push(address || null); }
    if (website !== undefined) { sets.push("website = ?"); params.push(website || null); }
    if (hours !== undefined) { sets.push("hours = ?"); params.push(hours || null); }
    if (target_areas !== undefined) { sets.push("target_areas = ?"); params.push(target_areas || null); }
    if (logo_url !== undefined) { sets.push("logo_url = ?"); params.push(logo_url || null); }
    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
    params.push(businessId);
    await query(`UPDATE businesses SET ${sets.join(", ")} WHERE id = ?`, params);
    res.json({ message: "Business profile updated successfully" });
  } catch (err) { console.error("Update business profile error:", err); res.status(500).json({ error: "Failed to update business profile" }); }
});

// Services
router.get("/business/services", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const services = await query(`SELECT * FROM services WHERE business_id = ?`, [businessId]);
  res.json(services);
});

router.post("/business/services", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { name, description, price, duration } = req.body;
  const id = generateId();
  try { await query(`INSERT INTO services (id, business_id, name, description, price, duration) VALUES (?, ?, ?, ?, ?, ?)`, [id, businessId, name, description || null, price || 0, duration || 30]); res.status(201).json({ id, name }); }
  catch (err) { res.status(500).json({ error: "Failed to add service" }); }
});

router.get("/services", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const services = await query(`SELECT * FROM services WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
  res.json(services);
});

router.post("/services", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { name, description, price, duration } = req.body;
  if (!name || price === undefined || !duration) return res.status(400).json({ error: "Name, price, and duration are required" });
  const id = generateId();
  try { await query(`INSERT INTO services (id, business_id, name, description, price, duration) VALUES (?, ?, ?, ?, ?, ?)`, [id, businessId, name, description || null, Number(price), Number(duration)]); res.status(201).json({ id, name, description, price, duration }); }
  catch (err) { res.status(500).json({ error: "Failed to create service" }); }
});

router.delete("/services/:id", authenticate, async (req, res) => {
  const { businessId } = req.user!; const { id } = req.params;
  try { await query(`DELETE FROM services WHERE id = ? AND business_id = ?`, [id, businessId]); res.json({ message: "Service deleted successfully" }); }
  catch (err) { res.status(500).json({ error: "Failed to delete service" }); }
});

// Media
router.get("/business/media", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const media = await query(`SELECT * FROM media WHERE business_id = ?`, [businessId]);
  res.json(media);
});

router.post("/business/media", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { url, type } = req.body;
  const id = generateId();
  try { await query(`INSERT INTO media (id, business_id, url, type) VALUES (?, ?, ?, ?)`, [id, businessId, url, type]); res.status(201).json({ id, url }); }
  catch (err) { res.status(500).json({ error: "Failed to add media" }); }
});

router.get("/media", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const media = await query(`SELECT * FROM media WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
  res.json(media);
});

router.post("/media", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { url, type, name } = req.body;
  if (!url || !type) return res.status(400).json({ error: "URL and type are required" });
  const id = generateId();
  try { await query(`INSERT INTO media (id, business_id, url, type, name) VALUES (?, ?, ?, ?, ?)`, [id, businessId, url, type, name || null]); res.status(201).json({ id, url, type, name }); }
  catch (err) { res.status(500).json({ error: "Failed to add media" }); }
});

router.delete("/media/:id", authenticate, async (req, res) => {
  const { businessId } = req.user!; const { id } = req.params;
  try { await query(`DELETE FROM media WHERE id = ? AND business_id = ?`, [id, businessId]); res.json({ message: "Media deleted successfully" }); }
  catch (err) { res.status(500).json({ error: "Failed to delete media" }); }
});

// Social accounts
router.get("/social-accounts", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const accounts = await query(`SELECT * FROM social_accounts WHERE business_id = ?`, [businessId]);
  res.json(accounts);
});

router.post("/social-accounts/connect", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { platform, username } = req.body;
  if (!platform) return res.status(400).json({ error: "Platform is required" });
  try {
    const existing = await query(`SELECT id FROM social_accounts WHERE business_id = ? AND platform = ?`, [businessId, platform]);
    if (existing && existing.length > 0) {
      await query(`UPDATE social_accounts SET status = 'connected', username = ? WHERE id = ?`, [username || null, (existing[0] as any).id]);
      return res.json({ message: "Social account connected successfully" });
    }
    const id = generateId();
    await query(`INSERT INTO social_accounts (id, business_id, platform, username, status) VALUES (?, ?, ?, ?, 'connected')`, [id, businessId, platform, username || null]);
    res.status(201).json({ id, platform, username, status: "connected" });
  } catch (err) { res.status(500).json({ error: "Failed to connect social account" }); }
});

router.post("/social-accounts/disconnect", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { platform } = req.body;
  try { await query(`DELETE FROM social_accounts WHERE business_id = ? AND platform = ?`, [businessId, platform]); res.json({ message: "Social account disconnected successfully" }); }
  catch (err) { res.status(500).json({ error: "Failed to disconnect social account" }); }
});

export default router;