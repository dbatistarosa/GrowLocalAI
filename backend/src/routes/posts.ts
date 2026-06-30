import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";
import { PLAN_LIMITS, generateId } from "../lib/utils.js";
import { generateSocialPosts, generatePromoVideo } from "../ai.js";

const router = Router();

async function checkUsageLimit(businessId: string, tier: string, feature: string) {
  const limit = PLAN_LIMITS[tier] || 12;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
  const usage = await query(
    `SELECT * FROM subscription_usage WHERE business_id = ? AND feature = ? AND period_start = ?`,
    [businessId, feature, startOfMonth]
  );
  if (!usage || usage.length === 0) {
    const id = generateId();
    await query(
      `INSERT INTO subscription_usage (id, business_id, feature, period_start, period_end, count_used, limit_amount) VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [id, businessId, feature, startOfMonth, endOfMonth, limit]
    );
    return { current: 0, limit, exceeded: 0 >= limit };
  }
  const currentUsage = usage[0] as any;
  return { current: currentUsage.count_used, limit: currentUsage.limit_amount, exceeded: currentUsage.count_used >= currentUsage.limit_amount };
}

async function incrementUsage(businessId: string, feature: string) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  await query(`UPDATE subscription_usage SET count_used = count_used + 1 WHERE business_id = ? AND feature = ? AND period_start = ?`, [businessId, feature, startOfMonth]);
}

router.get("/posts", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const posts = await query(`SELECT * FROM posts WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
    res.json(posts);
  } catch (err) { res.status(500).json({ error: "Failed to fetch posts" }); }
});

router.post("/ai/generate-posts", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const businesses = await query(`SELECT name, category, tier FROM businesses WHERE id = ?`, [businessId]);
    if (!businesses || businesses.length === 0) return res.status(404).json({ error: "Business not found" });
    const { name, category, tier } = businesses[0] as any;
    const usage = await checkUsageLimit(businessId, tier, 'social_posts');
    if (usage.exceeded) return res.status(403).json({ error: "Monthly post limit reached. Please upgrade your plan." });
    const generatedPosts = await generateSocialPosts(businessId, category, name);
    await incrementUsage(businessId, 'social_posts');
    res.status(201).json({ message: "Successfully generated 3 social post options", posts: generatedPosts, usage: { used: usage.current + 1, limit: usage.limit } });
  } catch (err) { console.error("AI Generation Route Error:", err); res.status(500).json({ error: "Failed to generate posts with AI" }); }
});

router.post("/ai/generate-video", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { postContent } = req.body;
  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    if ((businesses[0] as any)?.tier !== 'Premium') return res.status(403).json({ error: "Video generation is a Premium feature" });
    const videoData = await generatePromoVideo(businessId, postContent || "Our latest services");
    res.status(201).json(videoData);
  } catch (err) { res.status(500).json({ error: "Failed to generate video" }); }
});

router.post("/posts/create", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { content, imageUrl, scheduledAt, status } = req.body;
  if (!content) return res.status(400).json({ error: "Content is required" });
  try {
    const id = generateId();
    const postStatus = status || "scheduled";
    await query(`INSERT INTO posts (id, business_id, content, image_url, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?)`, [id, businessId, content, imageUrl || null, scheduledAt || null, postStatus]);
    res.status(201).json({ id, content, image_url: imageUrl, scheduled_at: scheduledAt, status: postStatus });
  } catch (err) { res.status(500).json({ error: "Failed to create post" }); }
});

router.patch("/posts/:id", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { id } = req.params;
  const { status, scheduled_at, content } = req.body;
  try {
    const sets: string[] = []; const params: any[] = [];
    if (status) { sets.push("status = ?"); params.push(status); }
    if (scheduled_at) { sets.push("scheduled_at = ?"); params.push(scheduled_at); }
    if (content) { sets.push("content = ?"); params.push(content); }
    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
    params.push(id, businessId);
    await query(`UPDATE posts SET ${sets.join(", ")} WHERE id = ? AND business_id = ?`, params);
    res.json({ message: "Post updated successfully" });
  } catch (err) { res.status(500).json({ error: "Failed to update post" }); }
});

router.delete("/posts/:id", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { id } = req.params;
  try { await query(`DELETE FROM posts WHERE id = ? AND business_id = ?`, [id, businessId]); res.json({ message: "Post deleted successfully" }); }
  catch (err) { res.status(500).json({ error: "Failed to delete post" }); }
});

router.post("/posts/:id/regenerate", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { id } = req.params;
  const { tone } = req.body;
  try {
    const posts_ = await query(`SELECT * FROM posts WHERE id = ? AND business_id = ?`, [id, businessId]);
    if (!posts_ || posts_.length === 0) return res.status(404).json({ error: "Post not found" });
    const businesses = await query(`SELECT category, name FROM businesses WHERE id = ?`, [businessId]);
    const { category, name } = businesses[0] as any;
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: `You are an expert social media marketer. Regenerate a social media caption for a local ${category} business named "${name}".` }, { role: "user", content: `Please write a new scroll-stopping, high-converting social media post caption. Tone style requested: ${tone || "engaging"}. Include hooks, hashtags, emojis, and a clear call to action. Keep it clean and ready to publish.` }]
    });
    const newContent = response.choices[0].message.content || (posts_[0] as any).content;
    await query(`UPDATE posts SET content = ? WHERE id = ? AND business_id = ?`, [newContent, id, businessId]);
    res.json({ id, content: newContent, image_url: (posts_[0] as any).image_url });
  } catch (err) { console.error("Regenerate post error:", err); res.status(500).json({ error: "Failed to regenerate post" }); }
});

router.post("/posts/:id/generate-video", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { id } = req.params;
  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    if (!businesses || (businesses[0] as any).tier !== "Premium") return res.status(403).json({ error: "AI Video generation is only available on the Premium plan." });
    const posts_ = await query(`SELECT content FROM posts WHERE id = ? AND business_id = ?`, [id, businessId]);
    if (!posts_ || posts_.length === 0) return res.status(404).json({ error: "Post not found" });
    const videoData = await generatePromoVideo(businessId, (posts_[0] as any).content);
    res.json(videoData);
  } catch (err) { res.status(500).json({ error: "Failed to generate AI video" }); }
});

export default router;