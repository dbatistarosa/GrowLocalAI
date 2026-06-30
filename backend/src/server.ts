import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";

console.log(`[Server] Initial NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[Server] Current Working Directory: ${process.cwd()}`);
import { generateSocialPosts, chatWithAI, generatePromoVideo, supportChatWithAI, generateSEOKeywords, generateGBPContentSuggestions } from "./ai.js";

// Extremely lightweight, zero-dependency .env loader
try {
  const envPath = path.join(process.cwd(), "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=");
        process.env[key.trim()] = value.trim();
      }
    }
  }
} catch (err) {
  console.warn("Failed to load .env file:", err);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV !== "test") {
  console.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Crypto helpers using bcrypt and jsonwebtoken
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

function signToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: '7d' });
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET as string);
  } catch {
    return null;
  }
}

// Auth Middleware
async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as any).user = decoded;
  next();
}

// Admin Auth Middleware
async function authenticateAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const tokenString = authHeader.substring(7);
  const decoded = verifyToken(tokenString);
  if (!decoded || !decoded.isAdmin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  // Verify against database for extra security
  try {
    const admins = await query(`SELECT id FROM admins WHERE id = ?`, [decoded.id]);
    if (!admins || admins.length === 0) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    (req as any).admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Helper to get base URL from request
function getBaseUrl(req: express.Request): string {
  const host = req.get("host") || "localhost:3000";
  return `${req.protocol}://${host}`;
}

// ---------------- API ROUTES ----------------

// Sign up
app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password, businessName, category } = req.body;

  if (!name || !email || !password || !businessName || !category) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    // Check if user already exists
    const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    const userId = crypto.randomUUID();
    const businessId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);

    // Create Business (Starter tier by default)
    await query(
      `INSERT INTO businesses (id, name, category, tier) VALUES (?, ?, ?, 'Starter')`,
      [businessId, businessName, category]
    );

    // Create User
    await query(
      `INSERT INTO users (id, name, email, password, business_id) VALUES (?, ?, ?, ?, ?)`,
      [userId, name, email, hashedPassword, businessId]
    );

    // Generate token
    const token = signToken({ userId, email, businessId });

    res.status(201).json({
      token,
      user: { id: userId, name, email },
      business: { id: businessId, name: businessName, category, tier: "Starter" }
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Registration failed. Try again." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const users = await query(
      `SELECT u.id as userId, u.name, u.email, u.password, u.business_id as businessId, b.name as businessName, b.category, b.tier
       FROM users u
       LEFT JOIN businesses b ON u.business_id = b.id
       WHERE u.email = ?`,
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0] as any;
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ userId: user.userId, email: user.email, businessId: user.businessId });

    res.json({
      token,
      user: { id: user.userId, name: user.name, email: user.email },
      business: { id: user.businessId, name: user.businessName, category: user.category, tier: user.tier }
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// Get Current User / Business Info
app.get("/api/user/me", authenticate, async (req, res) => {
  const { userId, businessId } = (req as any).user;

  try {
    const users = await query(
      `SELECT u.id as userId, u.name, u.email, u.business_id as businessId, b.name as businessName, b.category, b.tier
       FROM users u
       LEFT JOIN businesses b ON u.business_id = b.id
       WHERE u.id = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0] as any;
    res.json({
      user: { id: user.userId, name: user.name, email: user.email },
      business: { id: user.businessId, name: user.businessName, category: user.category, tier: user.tier }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// Get Social Posts for Business
app.get("/api/posts", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const posts = await query(`SELECT * FROM posts WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// ---------------- USAGE LIMITS HELPERS ----------------

const PLAN_LIMITS: Record<string, number> = {
  Starter: 12,
  Pro: 30,
  Premium: 999999 // unlimited
};

async function checkUsageLimit(businessId: string, tier: string, feature: string) {
  const limit = PLAN_LIMITS[tier] || 12;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const usage = await query(
    `SELECT * FROM subscription_usage 
     WHERE business_id = ? AND feature = ? AND period_start = ?`,
    [businessId, feature, startOfMonth]
  );

  if (!usage || usage.length === 0) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO subscription_usage (id, business_id, feature, period_start, period_end, count_used, limit_amount)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [id, businessId, feature, startOfMonth, endOfMonth, limit]
    );
    return { current: 0, limit, exceeded: 0 >= limit };
  }

  const currentUsage = usage[0] as any;
  return { 
    current: currentUsage.count_used, 
    limit: currentUsage.limit_amount, 
    exceeded: currentUsage.count_used >= currentUsage.limit_amount 
  };
}

async function incrementUsage(businessId: string, feature: string) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  await query(
    `UPDATE subscription_usage SET count_used = count_used + 1 
     WHERE business_id = ? AND feature = ? AND period_start = ?`,
    [businessId, feature, startOfMonth]
  );
}

// Generate Social Posts using AI
app.post("/api/ai/generate-posts", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;

  try {
    const businesses = await query(`SELECT name, category, tier FROM businesses WHERE id = ?`, [businessId]);
    if (!businesses || businesses.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    const { name, category, tier } = businesses[0] as any;
    
    // Enforce limits
    const usage = await checkUsageLimit(businessId, tier, 'social_posts');
    if (usage.exceeded) {
      return res.status(403).json({ error: "Monthly post limit reached. Please upgrade your plan." });
    }

    const generatedPosts = await generateSocialPosts(businessId, category, name);
    await incrementUsage(businessId, 'social_posts');

    res.status(201).json({
      message: "Successfully generated 3 social post options",
      posts: generatedPosts,
      usage: {
        used: usage.current + 1,
        limit: usage.limit
      }
    });
  } catch (err) {
    console.error("AI Generation Route Error:", err);
    res.status(500).json({ error: "Failed to generate posts with AI" });
  }
});

// Generate Promo Video using AI (Premium)
app.post("/api/ai/generate-video", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { postContent } = req.body;

  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    if ((businesses[0] as any)?.tier !== 'Premium') {
      return res.status(403).json({ error: "Video generation is a Premium feature" });
    }

    const videoData = await generatePromoVideo(businessId, postContent || "Our latest services");
    res.status(201).json(videoData);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate video" });
  }
});

// ---------------- BUSINESS PROFILE ROUTES ----------------

// Update Business Profile
app.patch("/api/business/profile", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { address, phone, email, website, hours } = req.body;

  try {
    await query(
      `UPDATE businesses 
       SET address = COALESCE(?, address), phone = COALESCE(?, phone), 
           email = COALESCE(?, email), website = COALESCE(?, website), 
           hours = COALESCE(?, hours)
       WHERE id = ?`,
      [address || null, phone || null, email || null, website || null, hours || null, businessId]
    );
    res.json({ message: "Profile updated" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// Service Catalog
app.get("/api/business/services", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const services = await query(`SELECT * FROM services WHERE business_id = ?`, [businessId]);
  res.json(services);
});

app.post("/api/business/services", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { name, description, price, duration } = req.body;
  const id = crypto.randomUUID();

  try {
    await query(
      `INSERT INTO services (id, business_id, name, description, price, duration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, businessId, name, description || null, price || 0, duration || 30]
    );
    res.status(201).json({ id, name });
  } catch (err) {
    res.status(500).json({ error: "Failed to add service" });
  }
});

// Media Library
app.get("/api/business/media", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const media = await query(`SELECT * FROM media WHERE business_id = ?`, [businessId]);
  res.json(media);
});

app.post("/api/business/media", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { url, type } = req.body;
  const id = crypto.randomUUID();

  try {
    await query(
      `INSERT INTO media (id, business_id, url, type) VALUES (?, ?, ?, ?)`,
      [id, businessId, url, type]
    );
    res.status(201).json({ id, url });
  } catch (err) {
    res.status(500).json({ error: "Failed to add media" });
  }
});

// ---------------- SOCIAL WEBHOOKS / DM BOTS ----------------

// Helper to process chat response for special actions (like bookings)
async function handleChatActions(businessId: string, response: string) {
  if (response.includes("[BOOKING:")) {
    try {
      const bookingJson = response.match(/\[BOOKING:(.*?)\]/)?.[1];
      if (bookingJson) {
        const bookingData = JSON.parse(bookingJson);
        const bookingId = crypto.randomUUID();
        await query(
          `INSERT INTO bookings (id, business_id, customer_name, customer_phone, service_id, date, time, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [bookingId, businessId, bookingData.name || "", bookingData.phone || "", bookingData.service || "", bookingData.date || "", bookingData.time || ""]
        );
      }
    } catch (e) {
      console.error("Booking parse error:", e);
    }
  }
  return response.replace(/\[BOOKING:.*?\]/, "").trim();
}

// Instagram DM Webhook
app.post("/api/ai/chat/instagram", async (req, res) => {
  const { businessId, senderId, message } = req.body;
  const rawResponse = await chatWithAI(businessId, senderId, message, 'instagram');
  const response = await handleChatActions(businessId, rawResponse);
  res.json({ response });
});

// WhatsApp Webhook
app.post("/api/ai/chat/whatsapp", async (req, res) => {
  const { businessId, senderId, message } = req.body;
  const rawResponse = await chatWithAI(businessId, senderId, message, 'whatsapp');
  const response = await handleChatActions(businessId, rawResponse);
  res.json({ response });
});

// ---------------- SUPPORT SYSTEM ROUTES ----------------

// AI Support Chatbot
app.post("/api/support/chat", authenticate, async (req, res) => {
  const { userId } = (req as any).user;
  const { conversationId, message } = req.body;

  try {
    const response = await supportChatWithAI(userId, conversationId, message);

    // Check for ticket tag
    if (response.includes("[TICKET:")) {
      try {
        const ticketJson = response.match(/\[TICKET:(.*?)\]/)?.[1];
        if (ticketJson) {
          const ticketData = JSON.parse(ticketJson);
          const ticketId = crypto.randomUUID();
          await query(
            `INSERT INTO support_tickets (id, user_id, subject, description, priority, status)
             VALUES (?, ?, ?, ?, ?, 'Open')`,
            [ticketId, userId, ticketData.subject || "AI Support Request", `Opened via AI Support Bot. Last message: ${message}`, ticketData.priority || "Medium"]
          );
        }
      } catch (e) {}
    }

    res.json({ response: response.replace(/\[TICKET:.*?\]/, "").trim() });
  } catch (err) {
    res.status(500).json({ error: "Support chat failed" });
  }
});

// Support Tickets
app.get("/api/support/tickets", authenticate, async (req, res) => {
  const { userId } = (req as any).user;
  const tickets = await query(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
  res.json(tickets);
});

app.post("/api/support/tickets", authenticate, async (req, res) => {
  const { userId } = (req as any).user;
  const { subject, description, priority } = req.body;
  const id = crypto.randomUUID();

  try {
    await query(
      `INSERT INTO support_tickets (id, user_id, subject, description, priority, status)
       VALUES (?, ?, ?, ?, ?, 'Open')`,
      [id, userId, subject, description, priority || "Medium"]
    );
    res.status(201).json({ id, subject });
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// ---------------- SEO INTELLIGENCE ROUTES ----------------

// Generate Keywords
app.post("/api/seo/keywords", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const keywords = await generateSEOKeywords(businessId);
    res.json({ keywords });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate keywords" });
  }
});

// Get SEO Metrics
app.get("/api/seo/metrics", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const metrics = await query(`SELECT * FROM seo_metrics WHERE business_id = ? ORDER BY created_at DESC LIMIT 1`, [businessId]);
  res.json(metrics[0] || { keywords: "[]", impressions: 0, clicks: 0, views: 0 });
});

// GBP Suggestions
app.get("/api/seo/gbp-suggestions", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const suggestions = await generateGBPContentSuggestions(businessId);
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

// AI Chatbot Route
app.post("/api/ai/chat", async (req, res) => {
  const { businessId, conversationId, message } = req.body;

  if (!businessId || !conversationId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const rawResponse = await chatWithAI(businessId, conversationId, message);
    const response = await handleChatActions(businessId, rawResponse);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: "Chat failed" });
  }
});

// ---------------- CALENDAR & BOOKING ROUTES ----------------

app.get("/api/bookings", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const bookings = await query(
    `SELECT b.*, s.name as service_name, s.price as service_price 
     FROM bookings b
     LEFT JOIN services s ON b.service_id = s.id
     WHERE b.business_id = ? ORDER BY b.date ASC, b.time ASC`,
    [businessId]
  );
  res.json(bookings);
});

app.patch("/api/bookings/:id", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Verify ownership
    const booking = await query(`SELECT * FROM bookings WHERE id = ? AND business_id = ?`, [id, businessId]);
    if (!booking || booking.length === 0) return res.status(404).json({ error: "Booking not found" });

    await query(`UPDATE bookings SET status = ? WHERE id = ? AND business_id = ?`, [status, id, businessId]);

    // If completed, track income
    if (status === 'completed') {
      const serviceId = (booking[0] as any).service_id;
      const services = await query(`SELECT price FROM services WHERE name = ? OR id = ?`, [serviceId, serviceId]);
      const price = (services[0] as any)?.price || 0;
      
      const incomeId = crypto.randomUUID();
      await query(
        `INSERT INTO income (id, business_id, booking_id, amount, status)
         VALUES (?, ?, ?, ?, 'received')`,
        [incomeId, businessId, id, price]
      );
    }

    res.json({ message: "Booking updated" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.get("/api/income", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const income = await query(`SELECT * FROM income WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
  const total = await query(`SELECT SUM(amount) as total FROM income WHERE business_id = ?`, [businessId]);
  res.json({ history: income, total: (total[0] as any)?.total || 0 });
});

// Get Chat History for Business
app.get("/api/ai/chat/history", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const history = await query(
      `SELECT conversation_id, role, content, created_at 
       FROM chat_messages 
       WHERE business_id = ? 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [businessId]
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// Get Chatbot Snippet
app.get("/api/ai/chatbot/snippet", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const baseUrl = getBaseUrl(req);
  
  const snippet = `
<!-- GrowLocal AI Chatbot -->
<script>
  window.GROWLOCAL_CONFIG = {
    businessId: "${businessId}",
    baseUrl: "${baseUrl}"
  };
</script>
<script src="${baseUrl}/chatbot.js" async></script>
<!-- End GrowLocal AI Chatbot -->
  `.trim();

  res.json({ snippet });
});

// Update Chatbot Config
app.patch("/api/ai/chatbot/config", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { config } = req.body;

  if (!config) {
    return res.status(400).json({ error: "Missing config data" });
  }

  try {
    const configString = JSON.stringify(config);
    await query(
      `UPDATE businesses SET chatbot_config = ? WHERE id = ?`,
      [configString, businessId]
    );
    res.json({ message: "Chatbot configuration updated successfully" });
  } catch (err) {
    console.error("Update chatbot config error:", err);
    res.status(500).json({ error: "Failed to update chatbot configuration" });
  }
});

// Get Reviews for Business (with optional request link info)
app.get("/api/reviews", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const reviews = await query(
      `SELECT r.*, rr.shareable_token as request_token
       FROM reviews r
       LEFT JOIN review_requests rr ON r.request_id = rr.id
       WHERE r.business_id = ?
       ORDER BY r.created_at DESC`,
      [businessId]
    );
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ---- REVIEW REQUEST SYSTEM ----

// Create Review Request with shareable link
app.post("/api/review-requests", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { customerName, customerEmail, customerPhone, method } = req.body;

  if (!customerName) {
    return res.status(400).json({ error: "Customer name is required" });
  }

  try {
    const id = crypto.randomUUID();
    const shareableToken = crypto.randomBytes(16).toString("hex");
    const sendMethod = method || "link";

    await query(
      `INSERT INTO review_requests (id, business_id, customer_name, customer_email, customer_phone, shareable_token, method, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, businessId, customerName, customerEmail || null, customerPhone || null, shareableToken, sendMethod]
    );

    const baseUrl = getBaseUrl(req);
    const shareableLink = `${baseUrl}/r/${shareableToken}`;

    res.status(201).json({
      id,
      customerName,
      shareableLink,
      shareableToken,
      method: sendMethod,
      status: "pending",
      message: `Review request created. Share this link: ${shareableLink}`
    });
  } catch (err) {
    console.error("Create review request error:", err);
    res.status(500).json({ error: "Failed to create review request" });
  }
});

// Get Review Requests for Business
app.get("/api/review-requests", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const requests = await query(
      `SELECT rr.*, 
        (SELECT COUNT(*) FROM reviews r WHERE r.request_id = rr.id) as review_count
       FROM review_requests rr
       WHERE rr.business_id = ?
       ORDER BY rr.created_at DESC`,
      [businessId]
    );

    const baseUrl = getBaseUrl(req);
    const enriched = (requests as any[]).map((r) => ({
      ...r,
      shareableLink: `${baseUrl}/r/${r.shareable_token}`
    }));

    res.json(enriched);
  } catch (err) {
    console.error("Fetch review requests error:", err);
    res.status(500).json({ error: "Failed to fetch review requests" });
  }
});

// Review Request Stats
app.get("/api/review-requests/stats", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const stats = await query(
      `SELECT
         COUNT(*) as total_requests,
         SUM(CASE WHEN status = 'sent' OR sent_at IS NOT NULL THEN 1 ELSE 0 END) as sent_count,
         SUM(CASE WHEN status = 'reviewed' OR reviewed_at IS NOT NULL THEN 1 ELSE 0 END) as reviewed_count,
         SUM(CASE WHEN status = 'pending' AND sent_at IS NULL THEN 1 ELSE 0 END) as pending_count
       FROM review_requests
       WHERE business_id = ?`,
      [businessId]
    );

    const data = (stats[0] as any) || { total_requests: 0, sent_count: 0, reviewed_count: 0, pending_count: 0 };
    data.conversion_rate = data.total_requests > 0
      ? Math.round((data.reviewed_count / data.total_requests) * 100)
      : 0;

    res.json(data);
  } catch (err) {
    console.error("Review request stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Mark Review Request as Sent
app.patch("/api/review-requests/:id/track-sent", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;

  try {
    // Verify ownership
    const requests = await query(`SELECT id FROM review_requests WHERE id = ? AND business_id = ?`, [id, businessId]);
    if (!requests || requests.length === 0) {
      return res.status(404).json({ error: "Review request not found" });
    }

    await query(
      `UPDATE review_requests SET sent_at = datetime('now'), status = 'sent' WHERE id = ? AND business_id = ?`,
      [id, businessId]
    );

    res.json({ message: "Review request marked as sent" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update review request" });
  }
});

// ---- PUBLIC REVIEW SUBMISSION (via shareable link) ----

// Serve public review page
app.get("/r/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const requests = await query(
      `SELECT rr.id, rr.customer_name, rr.status, rr.reviewed_at, b.name as business_name, b.category
       FROM review_requests rr
       JOIN businesses b ON rr.business_id = b.id
       WHERE rr.shareable_token = ?`,
      [token]
    );

    if (!requests || requests.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Review Not Found</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#1e293b;border-radius:1rem;padding:2rem;max-width:400px;text-align:center;border:1px solid #334155}
        h1{color:#94a3b8} p{color:#64748b}</style></head>
        <body><div class="card"><h1>🔗 Link Not Found</h1><p>This review request link is invalid or has expired.</p></div></body>
        </html>
      `);
    }

    const request = requests[0] as any;
    const safeName = request.customer_name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeBusinessName = request.business_name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeCategory = (request.category || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    if (request.status === "reviewed") {
      return res.send(`
        <!DOCTYPE html>
        <html><head><title>Review Already Submitted</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#1e293b;border-radius:1rem;padding:2rem;max-width:400px;text-align:center;border:1px solid #334155}
        h1{color:#22c55e} p{color:#94a3b8}</style></head>
        <body><div class="card"><h1>✅ Review Already Submitted</h1><p>Thank you, ${safeName}! You've already left a review for <strong>${safeBusinessName}</strong>.</p></div></body>
        </html>
      `);
    }

    // Serve the review submission form with HTML-escaped values
    res.send(`
      <!DOCTYPE html>
      <html><head>
        <title>Leave a Review - ${safeBusinessName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          *{box-sizing:border-box}
          body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem}
          .card{background:#1e293b;border-radius:1rem;padding:2rem;max-width:480px;width:100%;border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,.5)}
          h1{font-size:1.5rem;margin:0 0 .25rem;color:#f8fafc}
          .subtitle{color:#94a3b8;font-size:.9rem;margin-bottom:1.5rem}
          .rating-select{display:flex;gap:.5rem;justify-content:center;margin-bottom:1.5rem}
          .star-btn{background:0;border:2px solid #334155;border-radius:.75rem;padding:.5rem .75rem;cursor:pointer;font-size:1.5rem;transition:all .15s}
          .star-btn:hover,.star-btn.selected{border-color:#a855f7;background:#a855f710}
          .star-btn.selected{background:#a855f720}
          label{display:block;font-size:.85rem;font-weight:600;color:#94a3b8;margin-bottom:.5rem}
          textarea{width:100%;background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:.75rem;color:#f8fafc;font-size:.95rem;resize:vertical;font-family:inherit}
          textarea:focus{outline:none;border-color:#a855f7}
          button[type=submit]{width:100%;background:#a855f7;color:#fff;border:none;border-radius:.75rem;padding:.85rem;font-size:1rem;font-weight:700;cursor:pointer;transition:background .15s;margin-top:1rem}
          button[type=submit]:hover{background:#9333ea}
          button[type=submit]:disabled{opacity:.5;cursor:not-allowed}
          .success{text-align:center}
          .success h2{color:#22c55e;font-size:1.3rem}
          .success p{color:#94a3b8;font-size:.9rem}
          .error{color:#ef4444;font-size:.85rem;margin-top:.5rem}
          .business-badge{display:inline-block;background:#a855f715;color:#a855f7;border:1px solid #a855f730;border-radius:.5rem;padding:.25rem .75rem;font-size:.8rem;font-weight:600;margin-bottom:.75rem}
        </style>
      </head><body>
        <div class="card" id="app">
          <div style="text-align:center">
            <div class="business-badge">${safeBusinessName} (${safeCategory})</div>
            <h1>Hi ${safeName}!</h1>
            <p class="subtitle">How was your experience? Leave a review below.</p>
          </div>
          <form id="reviewForm">
            <div class="rating-select" id="ratingSelect">
              ${[1,2,3,4,5].map(n => 
                `<button type="button" class="star-btn" data-rating="${n}">${'⭐'.repeat(n)}</button>`
              ).join('')}
            </div>
            <label for="comment">Your Review</label>
            <textarea id="comment" rows="3" placeholder="Tell us about your experience..." required></textarea>
            <div id="formError" class="error" style="display:none"></div>
            <button type="submit" id="submitBtn">Submit Review</button>
          </form>
        </div>
        <script>
          let selectedRating = 0;
          const stars = document.querySelectorAll('.star-btn');
          stars.forEach(btn => {
            btn.addEventListener('click', () => {
              selectedRating = parseInt(btn.dataset.rating);
              stars.forEach(s => s.classList.toggle('selected', parseInt(s.dataset.rating) <= selectedRating));
            });
          });
          document.getElementById('reviewForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (selectedRating === 0) { alert('Please select a rating'); return; }
            const comment = document.getElementById('comment').value;
            const btn = document.getElementById('submitBtn');
            btn.disabled = true; btn.textContent = 'Submitting...';
            try {
              const res = await fetch('/api/r/${token}/submit', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ rating: selectedRating, comment })
              });
              if (!res.ok) throw new Error('Submission failed');
              document.getElementById('app').innerHTML = 
                '<div class="success"><h2>✅ Thank You!</h2><p>Your review for <strong>${safeBusinessName}</strong> has been submitted. We really appreciate your feedback!</p></div>';
            } catch(err) {
              document.getElementById('formError').textContent = 'Failed to submit review. Please try again.';
              document.getElementById('formError').style.display = 'block';
              btn.disabled = false; btn.textContent = 'Submit Review';
            }
          });
        </script>
      </body></html>
    `);
  } catch (err) {
    console.error("Public review page error:", err);
    res.status(500).send("Error loading review page.");
  }
});

// Submit review via shareable link
app.post("/api/r/:token/submit", async (req, res) => {
  const { token } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }

  try {
    const requests = await query(
      `SELECT id, business_id, customer_name, status FROM review_requests WHERE shareable_token = ?`,
      [token]
    );

    if (!requests || requests.length === 0) {
      return res.status(404).json({ error: "Review request not found" });
    }

    const request_ = requests[0] as any;

    if (request_.status === "reviewed") {
      return res.status(400).json({ error: "Review already submitted for this request" });
    }

    const reviewId = crypto.randomUUID();

    // Insert the review
    await query(
      `INSERT INTO reviews (id, business_id, customer_name, rating, comment, status, request_id)
       VALUES (?, ?, ?, ?, ?, 'published', ?)`,
      [reviewId, request_.business_id, request_.customer_name, rating, comment || "", request_.id]
    );

    // Mark the request as reviewed
    await query(
      `UPDATE review_requests SET status = 'reviewed', reviewed_at = datetime('now') WHERE id = ?`,
      [request_.id]
    );

    res.status(201).json({ message: "Review submitted successfully", id: reviewId });
  } catch (err) {
    console.error("Review submission error:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// Legacy endpoint: Create review request (for backward compatibility)
app.post("/api/reviews/request", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { customerName } = req.body;

  if (!customerName) {
    return res.status(400).json({ error: "Customer name is required" });
  }

  try {
    const id = crypto.randomUUID();
    const shareableToken = crypto.randomBytes(16).toString("hex");

    await query(
      `INSERT INTO review_requests (id, business_id, customer_name, shareable_token, method, status)
       VALUES (?, ?, ?, ?, 'link', 'pending')`,
      [id, businessId, customerName, shareableToken]
    );

    const baseUrl = getBaseUrl(req);
    const shareableLink = `${baseUrl}/r/${shareableToken}`;

    res.status(201).json({
      message: "Review request created successfully",
      id,
      shareableLink,
      customerName
    });
  } catch (err) {
    console.error("Legacy review request error:", err);
    res.status(500).json({ error: "Failed to create review request" });
  }
});

// ---- STRIPE BILLING INTEGRATION ----

const STRIPE_PLANS = {
  Starter: {
    id: "Starter",
    price: 149.99,
    priceId: "price_1TjPVMDwVs5LOLSiu0vA3lKA",
    checkoutUrl: "https://buy.stripe.com/28EdR96thgBo2LIb0m2go03",
    features: ["12 AI Social Posts/mo", "Automated Review Requests", "Basic Website Chatbot", "1 Instagram Connection"]
  },
  Pro: {
    id: "Pro",
    price: 499.99,
    priceId: "price_1TjPVMDwVs5LOLSiewrI25j5",
    checkoutUrl: "https://buy.stripe.com/cNi00jdVJetg1HE9Wi2go04",
    features: ["30 AI Social Posts/mo", "AI Instagram DM Chatbot", "WhatsApp Automation", "GBP Management", "SEO Dashboard", "Calendar Reservations"]
  },
  Premium: {
    id: "Premium",
    price: 999.99,
    priceId: "price_1TjPVMDwVs5LOLSiNDtJVWPv",
    checkoutUrl: "https://buy.stripe.com/aFa3cv8Bpad0euq8Se2go05",
    features: ["Unlimited AI Posts", "AI Video Creation", "Human Review of Content", "Competitor Tracking", "Income Tracking", "Priority Support"]
  }
};

const TIER_LIMITS = {
  Starter: {
    label: "Starter",
    postsPerMonth: 12,
    videosPerMonth: 0,
    chatbotCount: 1,
    instagramConnections: 1,
    gbpManagement: false,
    calendar: false,
    whatsapp: false,
    competitorTracking: false,
    incomeTracking: false,
    tabs: ["overview", "social", "reviews", "support", "faq", "settings"]
  },
  Pro: {
    label: "Pro",
    postsPerMonth: 30,
    videosPerMonth: 0,
    chatbotCount: 1,
    instagramConnections: 1,
    gbpManagement: true,
    calendar: true,
    whatsapp: true,
    competitorTracking: false,
    incomeTracking: false,
    tabs: ["overview", "social", "reviews", "chatbot", "seo", "support", "faq", "settings"]
  },
  Premium: {
    label: "Premium",
    postsPerMonth: -1,
    videosPerMonth: -1,
    chatbotCount: -1,
    instagramConnections: -1,
    gbpManagement: true,
    calendar: true,
    whatsapp: true,
    competitorTracking: true,
    incomeTracking: true,
    tabs: ["overview", "social", "reviews", "chatbot", "seo", "competitors", "income", "support", "faq", "settings"]
  }
};

// Get billing plans and status
app.get("/api/billing/plans", (_req, res) => {
  res.json({
    plans: Object.values(STRIPE_PLANS),
    public: Object.entries(STRIPE_PLANS).map(([key, plan]) => ({
      id: plan.id,
      name: key,
      price: plan.price,
      checkoutUrl: plan.checkoutUrl,
      features: plan.features
    }))
  });
});

// Get current subscription status
app.get("/api/billing/status", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const businesses = await query(
      `SELECT tier, stripe_customer_id, stripe_subscription_id, stripe_subscription_status FROM businesses WHERE id = ?`,
      [businessId]
    );
    if (!businesses || businesses.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }
    const biz = businesses[0] as any;
    const plans = Object.values(STRIPE_PLANS).map(p => ({
      id: p.id,
      name: p.id,
      price: p.price,
      checkoutUrl: p.checkoutUrl,
      features: p.features
    }));
    res.json({
      currentPlan: biz.tier || "Starter",
      subscriptionStatus: biz.stripe_subscription_status || "incomplete",
      stripeCustomerId: biz.stripe_customer_id,
      stripeSubscriptionId: biz.stripe_subscription_id,
      plans,
      isActive: biz.stripe_subscription_status === "active" || biz.stripe_subscription_status === "trialing" || !biz.stripe_subscription_id
    });
  } catch (err) {
    console.error("Billing status error:", err);
    res.status(500).json({ error: "Failed to fetch billing status" });
  }
});

// ---- NEW PLATFORM OVERHAUL ENDPOINTS ----

// Services
app.get("/api/services", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const services = await query(`SELECT * FROM services WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

app.post("/api/services", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { name, description, price, duration } = req.body;
  if (!name || price === undefined || !duration) {
    return res.status(400).json({ error: "Name, price, and duration are required" });
  }
  try {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO services (id, business_id, name, description, price, duration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, businessId, name, description || null, Number(price), Number(duration)]
    );
    res.status(201).json({ id, name, description, price, duration });
  } catch (err) {
    res.status(500).json({ error: "Failed to create service" });
  }
});

app.delete("/api/services/:id", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;
  try {
    await query(`DELETE FROM services WHERE id = ? AND business_id = ?`, [id, businessId]);
    res.json({ message: "Service deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete service" });
  }
});

// Bookings
app.get("/api/bookings", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const bookings = await query(
      `SELECT b.*, s.name as service_name, s.price as service_price 
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.business_id = ?
       ORDER BY b.date ASC, b.time ASC`,
      [businessId]
    );
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

app.post("/api/bookings", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { customerName, customerEmail, customerPhone, serviceId, date, time, status } = req.body;
  if (!customerName || !date || !time) {
    return res.status(400).json({ error: "Customer name, date, and time are required" });
  }
  try {
    const id = crypto.randomUUID();
    const bookingStatus = status || "confirmed";
    await query(
      `INSERT INTO bookings (id, business_id, customer_name, customer_email, customer_phone, service_id, date, time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, businessId, customerName, customerEmail || null, customerPhone || null, serviceId || null, date, time, bookingStatus]
    );
    res.status(201).json({ id, customerName, customerEmail, customerPhone, serviceId, date, time, status: bookingStatus });
  } catch (err) {
    res.status(500).json({ error: "Failed to create booking" });
  }
});

app.patch("/api/bookings/:id", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status is required" });
  try {
    await query(`UPDATE bookings SET status = ? WHERE id = ? AND business_id = ?`, [status, id, businessId]);
    res.json({ message: "Booking updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// Social Accounts
app.get("/api/social-accounts", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const accounts = await query(`SELECT * FROM social_accounts WHERE business_id = ?`, [businessId]);
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch social accounts" });
  }
});

app.post("/api/social-accounts/connect", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { platform, username } = req.body;
  if (!platform) return res.status(400).json({ error: "Platform is required" });
  try {
    const id = crypto.randomUUID();
    const existing = await query(`SELECT id FROM social_accounts WHERE business_id = ? AND platform = ?`, [businessId, platform]);
    if (existing && existing.length > 0) {
      await query(
        `UPDATE social_accounts SET status = 'connected', username = ? WHERE id = ?`,
        [username || null, (existing[0] as any).id]
      );
      return res.json({ message: "Social account connected successfully" });
    }
    await query(
      `INSERT INTO social_accounts (id, business_id, platform, username, status)
       VALUES (?, ?, ?, ?, 'connected')`,
      [id, businessId, platform, username || null]
    );
    res.status(201).json({ id, platform, username, status: "connected" });
  } catch (err) {
    res.status(500).json({ error: "Failed to connect social account" });
  }
});

app.post("/api/social-accounts/disconnect", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { platform } = req.body;
  try {
    await query(`DELETE FROM social_accounts WHERE business_id = ? AND platform = ?`, [businessId, platform]);
    res.json({ message: "Social account disconnected successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect social account" });
  }
});

// Media Library
app.get("/api/media", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const media = await query(`SELECT * FROM media WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
    res.json(media);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch media library" });
  }
});

app.post("/api/media", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { url, type, name } = req.body;
  if (!url || !type) return res.status(400).json({ error: "URL and type are required" });
  try {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO media (id, business_id, url, type, name) VALUES (?, ?, ?, ?, ?)`,
      [id, businessId, url, type, name || null]
    );
    res.status(201).json({ id, url, type, name });
  } catch (err) {
    res.status(500).json({ error: "Failed to add media" });
  }
});

app.delete("/api/media/:id", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;
  try {
    await query(`DELETE FROM media WHERE id = ? AND business_id = ?`, [id, businessId]);
    res.json({ message: "Media deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete media" });
  }
});

// ---------------- BUSINESS PROFILE ROUTES ----------------
app.patch("/api/business/profile", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { name, phone, email, address, website, hours, target_areas, logo_url } = req.body;
  try {
    const sets: string[] = [];
    const params: any[] = [];
    
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
  } catch (err) {
    console.error("Update business profile error:", err);
    res.status(500).json({ error: "Failed to update business profile" });
  }
});

// Social Posts Actions
app.patch("/api/posts/:id", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;
  const { status, scheduled_at, content } = req.body;
  try {
    const sets: string[] = [];
    const params: any[] = [];
    if (status) { sets.push("status = ?"); params.push(status); }
    if (scheduled_at) { sets.push("scheduled_at = ?"); params.push(scheduled_at); }
    if (content) { sets.push("content = ?"); params.push(content); }
    
    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });
    
    params.push(id, businessId);
    await query(`UPDATE posts SET ${sets.join(", ")} WHERE id = ? AND business_id = ?`, params);
    res.json({ message: "Post updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update post" });
  }
});

app.delete("/api/posts/:id", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;
  try {
    await query(`DELETE FROM posts WHERE id = ? AND business_id = ?`, [id, businessId]);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete post" });
  }
});

app.post("/api/posts/create", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { content, imageUrl, scheduledAt, status } = req.body;
  if (!content) return res.status(400).json({ error: "Content is required" });
  try {
    const id = crypto.randomUUID();
    const postStatus = status || "scheduled";
    await query(
      `INSERT INTO posts (id, business_id, content, image_url, scheduled_at, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, businessId, content, imageUrl || null, scheduledAt || null, postStatus]
    );
    res.status(201).json({ id, content, image_url: imageUrl, scheduled_at: scheduledAt, status: postStatus });
  } catch (err) {
    res.status(500).json({ error: "Failed to create post" });
  }
});

app.post("/api/posts/:id/regenerate", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
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
      messages: [
        { role: "system", content: `You are an expert social media marketer. Regenerate a social media caption for a local ${category} business named "${name}".` },
        { role: "user", content: `Please write a new scroll-stopping, high-converting social media post caption. Tone style requested: ${tone || "engaging"}. Include hooks, hashtags, emojis, and a clear call to action. Keep it clean and ready to publish.` }
      ]
    });
    const newContent = response.choices[0].message.content || (posts_[0] as any).content;
    
    await query(`UPDATE posts SET content = ? WHERE id = ? AND business_id = ?`, [newContent, id, businessId]);
    res.json({ id, content: newContent, image_url: (posts_[0] as any).image_url });
  } catch (err) {
    console.error("Regenerate post error:", err);
    res.status(500).json({ error: "Failed to regenerate post" });
  }
});

app.post("/api/posts/:id/generate-video", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { id } = req.params;
  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    if (!businesses || (businesses[0] as any).tier !== "Premium") {
      return res.status(403).json({ error: "AI Video generation is only available on the Premium plan." });
    }
    const posts_ = await query(`SELECT content FROM posts WHERE id = ? AND business_id = ?`, [id, businessId]);
    if (!posts_ || posts_.length === 0) return res.status(404).json({ error: "Post not found" });
    
    const videoData = await generatePromoVideo(businessId, (posts_[0] as any).content);
    res.json(videoData);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate AI video" });
  }
});

// ---------------- ADMIN PANEL ENDPOINTS ----------------

// Admin Login
app.post("/api/admin/login", async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: "Admin login failed" });
  }
});

// Admin Profile
app.get("/api/admin/me", authenticateAdmin, async (req, res) => {
  res.json((req as any).admin);
});

// List Businesses — uses dynamic WHERE so we build params array safely
app.get("/api/admin/businesses", authenticateAdmin, async (req, res) => {
  const { search, tier, status, sort, order = 'DESC', limit = 50, offset = 0 } = req.query;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  
  if (search) {
    where += ` AND (b.name LIKE ? OR b.email LIKE ? OR u.email LIKE ?)`;
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }
  if (tier) { where += ` AND b.tier = ?`; params.push(tier); }
  if (status) { where += ` AND b.stripe_subscription_status = ?`; params.push(status); }
  
  let orderBy = 'ORDER BY b.created_at';
  if (sort && typeof sort === 'string') orderBy = `ORDER BY b.${sort.replace(/[^a-zA-Z0-9_]/g, '')}`; // sanitize column name
  orderBy += ` ${order === 'ASC' ? 'ASC' : 'DESC'}`;

  try {
    const data = await query(
      `SELECT b.*, u.email as user_email, u.name as user_name,
              (SELECT COUNT(*) FROM posts WHERE business_id = b.id) as post_count,
              (SELECT COUNT(*) FROM bookings WHERE business_id = b.id) as booking_count,
              (SELECT COUNT(*) FROM reviews WHERE business_id = b.id) as review_count
       FROM businesses b
       LEFT JOIN users u ON u.business_id = b.id
       ${where}
       ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    const total = await query(
      `SELECT COUNT(*) as count FROM businesses b LEFT JOIN users u ON u.business_id = b.id ${where}`,
      params.length > 0 ? params : undefined
    );
    res.json({ businesses: data, total: (total as any[])[0].count });
  } catch (err) {
    console.error("Admin fetch businesses error:", err);
    res.status(500).json({ error: "Failed to fetch businesses" });
  }
});

// Business Detail
app.get("/api/admin/businesses/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const biz = await query(`SELECT * FROM businesses WHERE id = ?`, [id]);
    if (!biz || biz.length === 0) return res.status(404).json({ error: "Business not found" });
    const user = await query(`SELECT id, name, email, created_at FROM users WHERE business_id = ?`, [id]);
    const connections = await query(`SELECT platform, connected, username FROM social_connections WHERE business_id = ?`, [id]);
    const usage = await query(`SELECT feature, count_used, limit_amount FROM subscription_usage WHERE business_id = ?`, [id]);
    const bookings = await query(`SELECT * FROM bookings WHERE business_id = ? ORDER BY created_at DESC LIMIT 5`, [id]);
    res.json({ 
      ...(biz[0] as any), 
      user: (user as any)?.[0], 
      social_connections: connections,
      usage: usage,
      recent_bookings: bookings
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch business details" });
  }
});

// Update Business
app.patch("/api/admin/businesses/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const allowed = ['name', 'phone', 'email', 'address', 'website', 'category', 'description', 'target_areas'];
  const sets: string[] = [];
  const params: any[] = [];
  
  for (const key of Object.keys(updates)) {
    if (allowed.includes(key)) {
      sets.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }
  
  if (sets.length === 0) return res.status(400).json({ error: "No valid updates provided" });
  params.push(id);
  try {
    await query(`UPDATE businesses SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ message: "Business updated" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// Change Plan
app.patch("/api/admin/businesses/:id/plan", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { tier } = req.body;
  if (!tier) return res.status(400).json({ error: "Tier required" });
  try {
    await query(`UPDATE businesses SET tier = ? WHERE id = ?`, [tier, id]);
    res.json({ message: `Plan updated to ${tier}` });
  } catch (err) {
    res.status(500).json({ error: "Plan update failed" });
  }
});

// Change Status
app.patch("/api/admin/businesses/:id/status", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status required" });
  try {
    await query(`UPDATE businesses SET stripe_subscription_status = ? WHERE id = ?`, [status, id]);
    res.json({ message: `Status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: "Status update failed" });
  }
});

// Delete Business
app.delete("/api/admin/businesses/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query(`DELETE FROM users WHERE business_id = ?`, [id]);
    await query(`DELETE FROM posts WHERE business_id = ?`, [id]);
    await query(`DELETE FROM bookings WHERE business_id = ?`, [id]);
    await query(`DELETE FROM businesses WHERE id = ?`, [id]);
    res.json({ message: "Business deleted" });
  } catch (err) {
    res.status(500).json({ error: "Deletion failed" });
  }
});

// Refund (Mock)
app.post("/api/admin/businesses/:id/refund", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { amount, reason } = req.body;
  res.json({ message: "Refund processed (Mock mode)", amount, reason });
});

// Revenue Overview
app.get("/api/admin/revenue/overview", authenticateAdmin, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        SUM(CASE WHEN stripe_subscription_status = 'active' THEN 
          (CASE WHEN tier = 'Starter' THEN 149.99 WHEN tier = 'Pro' THEN 499.99 WHEN tier = 'Premium' THEN 999.99 ELSE 0 END)
        ELSE 0 END) as mrr,
        COUNT(CASE WHEN stripe_subscription_status = 'active' THEN 1 END) as active_subscribers
      FROM businesses
    `);
    const { mrr = 0, active_subscribers = 0 } = (stats[0] as any);
    const arpu = active_subscribers > 0 ? (mrr / active_subscribers) : 0;
    res.json({ mrr, active_subscribers, churn_rate: 2.5, arpu });
  } catch (err) {
    res.status(500).json({ error: "Revenue data failed" });
  }
});

// Revenue By Tier
app.get("/api/admin/revenue/by-tier", authenticateAdmin, async (req, res) => {
  try {
    const data = await query(`
      SELECT tier, COUNT(*) as count, 
             SUM(CASE WHEN tier = 'Starter' THEN 149.99 WHEN tier = 'Pro' THEN 499.99 WHEN tier = 'Premium' THEN 999.99 ELSE 0 END) as revenue
      FROM businesses
      WHERE stripe_subscription_status = 'active'
      GROUP BY tier
    `);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Revenue by tier failed" });
  }
});

// Revenue Trends (Mock/Stub)
app.get("/api/admin/revenue/trends", authenticateAdmin, async (req, res) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = months.map((m, i) => ({ month: m, revenue: 1000 + i * 500 + Math.random() * 200 }));
  res.json(data);
});

// Transactions
app.get("/api/admin/revenue/transactions", authenticateAdmin, async (req, res) => {
  try {
    const data = await query(`SELECT * FROM platform_transactions ORDER BY created_at DESC LIMIT 100`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Transactions fetch failed" });
  }
});

// Tickets
app.get("/api/admin/tickets", authenticateAdmin, async (req, res) => {
  const { status, priority } = req.query;
  let where = 'WHERE 1=1';
  const params: any[] = [];
  if (status) { where += ` AND t.status = ?`; params.push(status); }
  if (priority) { where += ` AND t.priority = ?`; params.push(priority); }
  try {
    const data = await query(
      `SELECT t.*, b.name as business_name, u.email as user_email
       FROM support_tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN businesses b ON u.business_id = b.id
       ${where}
       ORDER BY t.created_at DESC`,
      params.length > 0 ? params : undefined
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Tickets fetch failed" });
  }
});

app.get("/api/admin/tickets/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await query(
      `SELECT t.*, b.name as business_name, u.email as user_email
       FROM support_tickets t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN businesses b ON u.business_id = b.id
       WHERE t.id = ?`,
      [id]
    );
    if (!ticket || ticket.length === 0) return res.status(404).json({ error: "Ticket not found" });
    res.json(ticket[0]);
  } catch (err) {
    res.status(500).json({ error: "Ticket detail failed" });
  }
});

app.patch("/api/admin/tickets/:id", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, priority, assigned_to } = req.body;
  const sets: string[] = [];
  const params: any[] = [];
  if (status) { sets.push("status = ?"); params.push(status); }
  if (priority) { sets.push("priority = ?"); params.push(priority); }
  if (assigned_to) { sets.push("assigned_to = ?"); params.push(assigned_to); }
  
  if (sets.length === 0) return res.status(400).json({ error: "No updates provided" });
  params.push(id);
  
  try {
    await query(`UPDATE support_tickets SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ message: "Ticket updated" });
  } catch (err) {
    res.status(500).json({ error: "Ticket update failed" });
  }
});

app.post("/api/admin/tickets/:id/reply", authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });
  res.json({ message: "Reply sent (stub)" });
});

// Global Stats
app.get("/api/admin/stats", authenticateAdmin, async (req, res) => {
  try {
    const counts = await query(`
      SELECT 
        (SELECT COUNT(*) FROM businesses) as total_businesses,
        (SELECT COUNT(*) FROM posts) as total_posts,
        (SELECT COUNT(*) FROM reviews) as total_reviews,
        (SELECT COUNT(*) FROM bookings) as total_bookings,
        (SELECT COUNT(*) FROM businesses WHERE created_at >= date('now', '-30 days')) as signups_month
    `);
    res.json((counts[0] as any));
  } catch (err) {
    res.status(500).json({ error: "Stats failed" });
  }
});

// Get checkout URL for a specific plan (with user info pre-filled)
app.post("/api/billing/create-checkout", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { planId } = req.body;

  if (!planId || !STRIPE_PLANS[planId as keyof typeof STRIPE_PLANS]) {
    return res.status(400).json({ error: "Invalid plan. Choose Starter, Pro, or Premium." });
  }

  try {
    // Get user email for pre-fill
    const users = await query(`SELECT email FROM users WHERE business_id = ?`, [businessId]);
    const email = users && users.length > 0 ? (users[0] as any).email : "";

    const plan = STRIPE_PLANS[planId as keyof typeof STRIPE_PLANS];
    const baseUrl = getBaseUrl(req);

    const stripeCheckoutUrl = `${plan.checkoutUrl}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${businessId}&redirect_url=${encodeURIComponent(`${baseUrl}/billing/success?plan=${planId}&business_id=${businessId}`)}`;

    res.json({
      url: stripeCheckoutUrl,
      plan: plan.id,
      price: plan.price
    });
  } catch (err) {
    console.error("Create checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Handle Stripe checkout success redirect
app.get("/billing/success", async (req, res) => {
  const { plan, business_id } = req.query;

  if (plan && business_id) {
    try {
      await query(
        `UPDATE businesses SET tier = ?, stripe_subscription_status = 'active' WHERE id = ?`,
        [plan as string, business_id as string]
      );
      console.log(`Business ${business_id} upgraded to ${plan} plan`);
    } catch (err) {
      console.error("Failed to update tier after checkout:", err);
    }
  }

  res.redirect("/dashboard");
});

// Stripe Webhook endpoint for subscription status changes
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("sk_live_placeholder")) {
    console.log("Webhook received (raw mode):", req.body.toString().substring(0, 200));
    return res.json({ received: true });
  }

  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const businessId = session.client_reference_id;
        const tier = session.metadata?.tier || getTierFromPrice(session.amount_subtotal);

        if (businessId) {
          await query(
            `UPDATE businesses SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, stripe_subscription_status = 'active' WHERE id = ?`,
            [tier, session.customer || "", session.subscription || "", businessId]
          );

          try {
            const transId = crypto.randomUUID();
            await query(
              `INSERT INTO platform_transactions (id, business_id, amount, currency, tier, stripe_payment_intent_id, status)
               VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
              [transId, businessId, session.amount_total / 100, (session.currency?.toUpperCase() || 'USD'), tier, session.payment_intent || ""]
            );
          } catch (tErr) {
            console.error("Failed to log platform transaction:", tErr);
          }

          console.log(`Business ${businessId} subscribed to ${tier}`);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const status = subscription.status;

        const businesses = await query(`SELECT id FROM businesses WHERE stripe_subscription_id = ?`, [subscription.id]);
        if (businesses && businesses.length > 0) {
          await query(
            `UPDATE businesses SET stripe_subscription_status = ? WHERE id = ?`,
            [status, (businesses[0] as any).id]
          );
          console.log(`Subscription ${subscription.id} status updated to ${status}`);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const businesses = await query(`SELECT id FROM businesses WHERE stripe_subscription_id = ?`, [invoice.subscription]);
        if (businesses && businesses.length > 0) {
          await query(
            `UPDATE businesses SET stripe_subscription_status = 'past_due' WHERE id = ?`,
            [(businesses[0] as any).id]
          );
        }
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).send(`Webhook Error: ${err}`);
  }
});

function getTierFromPrice(amountCents: number): string {
  if (amountCents === 14999) return "Starter";
  if (amountCents === 49999) return "Pro";
  if (amountCents === 99999) return "Premium";
  if (amountCents === 9900) return "Starter";
  if (amountCents === 29900) return "Pro";
  if (amountCents === 59900) return "Premium";
  return "Starter";
}

// ---- SUBSCRIPTION LIMITS & FEATURE ACCESS ENGINE ----

app.get("/api/subscription/limits", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const businesses = await query(`SELECT tier, subscription_current_period_start, subscription_current_period_end FROM businesses WHERE id = ?`, [businessId]);
    const biz = (businesses as any)?.[0] || { tier: "Starter" };
    const tier = (biz.tier as string) || "Starter";
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Starter;

    const now = new Date().toISOString().split("T")[0];
    const usage = await query(
      `SELECT feature, count_used, limit_amount
       FROM subscription_usage
       WHERE business_id = ? AND period_start <= ? AND period_end >= ?`,
      [businessId, now, now]
    );

    const usageMap: Record<string, any> = {};
    (usage || []).forEach((u: any) => {
      usageMap[u.feature] = { used: u.count_used, limit: u.limit_amount };
    });

    res.json({
      tier,
      limits,
      usage: usageMap,
      periodStart: biz.subscription_current_period_start,
      periodEnd: biz.subscription_current_period_end,
      tabs: limits.tabs
    });
  } catch (err) {
    console.error("Subscription limits error:", err);
    res.status(500).json({ error: "Failed to load limits" });
  }
});

app.post("/api/subscription/usage/increment", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { feature } = req.body;

  if (!feature) return res.status(400).json({ error: "Feature name required" });

  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    const tier = (businesses?.[0] as any)?.tier || "Starter";
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Starter;
    const limitKey = `${feature}PerMonth` as keyof typeof limits;
    const limitAmount = (limits[limitKey] as number) ?? -1;

    if (limitAmount === 0) {
      return res.status(403).json({ error: `${feature} not available on your ${tier} plan`, upgrade: true });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const existing = await query(
      `SELECT id, count_used FROM subscription_usage
       WHERE business_id = ? AND feature = ? AND period_start = ?`,
      [businessId, feature, monthStart]
    );

    if (existing && existing.length > 0) {
      const current = existing[0] as any;
      if (limitAmount > 0 && current.count_used >= limitAmount) {
        return res.status(403).json({ error: `Monthly ${feature} limit reached (${current.count_used}/${limitAmount})`, upgrade: true });
      }
      await query(`UPDATE subscription_usage SET count_used = count_used + 1 WHERE id = ?`, [current.id]);
      res.json({ used: current.count_used + 1, limit: limitAmount });
    } else {
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO subscription_usage (id, business_id, feature, period_start, period_end, count_used, limit_amount)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [id, businessId, feature, monthStart, monthEnd, limitAmount]
      );
      res.json({ used: 1, limit: limitAmount });
    }
  } catch (err) {
    console.error("Usage increment error:", err);
    res.status(500).json({ error: "Failed to update usage" });
  }
});

app.post("/api/subscription/check-access", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  const { feature } = req.body;
  if (!feature) return res.status(400).json({ error: "Feature name required" });

  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    const tier = (businesses?.[0] as any)?.tier || "Starter";
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Starter;

    const boolKeys: Record<string, keyof typeof limits> = {
      "gbp": "gbpManagement",
      "calendar": "calendar",
      "whatsapp": "whatsapp",
      "competitors": "competitorTracking",
      "income": "incomeTracking"
    };

    const boolKey = boolKeys[feature];
    if (boolKey) {
      const hasAccess = limits[boolKey] === true;
      return res.json({ feature, tier, hasAccess, limit: hasAccess ? -1 : 0 });
    }

    const limitKey = `${feature}PerMonth` as keyof typeof limits;
    const limitAmount = (limits[limitKey] as number) ?? -1;
    res.json({ feature, tier, hasAccess: limitAmount !== 0, limit: limitAmount });
  } catch (err) {
    console.error("Access check error:", err);
    res.status(500).json({ error: "Failed to check access" });
  }
});

// ---- INTEGRATION FRAMEWORK (Instagram / GBP / Twilio) ----

app.get("/api/integrations/status", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const connections = await query(
      `SELECT platform, connected, username, connected_at, expires_at
       FROM social_connections
       WHERE business_id = ?`,
      [businessId]
    );
    res.json({
      integrations: [
        {
          platform: "instagram",
          name: "Instagram",
          connected: (connections || []).some((c: any) => c.platform === "instagram" && c.connected),
          enabled: true,
          docsUrl: "https://developers.facebook.com/docs/instagram-basic-display-api/",
          credentialsNeeded: ["Instagram App ID", "Instagram App Secret"]
        },
        {
          platform: "google_business_profile",
          name: "Google Business Profile",
          connected: (connections || []).some((c: any) => c.platform === "google_business_profile" && c.connected),
          enabled: true,
          docsUrl: "https://developers.google.com/my-business",
          credentialsNeeded: ["Google Cloud Project ID", "OAuth Client ID", "OAuth Client Secret"]
        },
        {
          platform: "twilio",
          name: "Twilio (SMS & WhatsApp)",
          connected: (connections || []).some((c: any) => c.platform === "twilio" && c.connected),
          enabled: true,
          docsUrl: "https://www.twilio.com/docs",
          credentialsNeeded: ["Twilio Account SID", "Twilio Auth Token", "Twilio Phone Number"]
        }
      ],
      details: connections || []
    });
  } catch (err) {
    console.error("Integration status error:", err);
    res.status(500).json({ error: "Failed to fetch integration status" });
  }
});

// Instagram connect endpoint (stub - redirect to OAuth)
app.get("/api/integrations/instagram/connect", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  res.json({
    message: "Instagram connection stub - replace with real OAuth URL",
    oauthUrl: `https://api.instagram.com/oauth/authorize?client_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(`${getBaseUrl(req)}/api/integrations/instagram/callback`)}&scope=user_profile,user_media&response_type=code`,
    status: "requires_app_credentials",
    credentialsNeeded: ["Instagram App ID (from Meta Developer Portal)", "Instagram App Secret"]
  });
});

// Instagram OAuth callback stub
app.get("/api/integrations/instagram/callback", async (req, res) => {
  const { code, state } = req.query;
  res.json({
    message: "Instagram OAuth callback received",
    code: code ? "received" : "missing",
    nextStep: "Exchange code for access token using App ID + App Secret",
    status: "stub_mode"
  });
});

// Google Business Profile connect stub
app.get("/api/integrations/gbp/connect", authenticate, async (req, res) => {
  res.json({
    message: "Google Business Profile connection stub",
    oauthUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(`${getBaseUrl(req)}/api/integrations/gbp/callback`)}&scope=https://www.googleapis.com/auth/business.manage&response_type=code&access_type=offline`,
    status: "requires_google_credentials",
    credentialsNeeded: ["Google Cloud Project ID", "OAuth Client ID", "OAuth Client Secret"]
  });
});

// GBP OAuth callback stub
app.get("/api/integrations/gbp/callback", async (req, res) => {
  const { code } = req.query;
  res.json({
    message: "GBP OAuth callback received",
    code: code ? "received" : "missing",
    nextStep: "Exchange code for access + refresh tokens",
    status: "stub_mode"
  });
});

// Twilio connect stub
app.get("/api/integrations/twilio/status", authenticate, async (req, res) => {
  res.json({
    message: "Twilio integration stub",
    status: "requires_credentials",
    configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    credentialsNeeded: ["Twilio Account SID", "Twilio Auth Token", "Twilio Phone Number"],
    note: "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env to activate"
  });
});

// Serve Static Frontend Assets in Production
const frontendDistPath = path.join(process.cwd(), "../frontend/dist");
app.use(express.static(frontendDistPath));

// Fallback all non-API GET requests to React's index.html
app.get("*", (req, res) => {
  if (!req.url.startsWith("/api") && !req.url.startsWith("/r/") && !req.url.startsWith("/billing/")) {
    res.sendFile(path.join(frontendDistPath, "index.html"), (err) => {
      if (err) {
        res.status(404).send("Site is building, please refresh in a moment!");
      }
    });
  } else {
    return;
  }
});

// Start Server bound publicly to 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
  console.log(`GrowLocal AI Server is live on port ${PORT} bound to all interfaces.`);
});