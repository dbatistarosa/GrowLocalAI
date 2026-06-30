import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";
import { generateSEOKeywords, generateGBPContentSuggestions } from "../ai.js";

const router = Router();

router.post("/seo/keywords", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try { const keywords = await generateSEOKeywords(businessId); res.json({ keywords }); }
  catch (err) { res.status(500).json({ error: "Failed to generate keywords" }); }
});

router.get("/seo/metrics", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const metrics = await query(`SELECT * FROM seo_metrics WHERE business_id = ? ORDER BY created_at DESC LIMIT 1`, [businessId]);
  res.json(metrics[0] || { keywords: "[]", impressions: 0, clicks: 0, views: 0 });
});

router.get("/seo/gbp-suggestions", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try { const suggestions = await generateGBPContentSuggestions(businessId); res.json(suggestions); }
  catch (err) { res.status(500).json({ error: "Failed to get suggestions" }); }
});

export default router;