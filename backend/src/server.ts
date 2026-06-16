import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { query } from "./db.js";
import { generateSocialPosts, chatWithAI } from "./ai.js";

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
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "growlocal-super-secret-key-2026";

app.use(cors());
app.use(express.json());

// Built-in lightweight crypto helpers for password hashing
function hashPassword(password: string): string {
  return crypto.createHmac("sha256", JWT_SECRET).update(password).digest("hex");
}

// Built-in lightweight JWT implementation to keep dependencies memory-light
function signToken(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}

function verifyToken(token: string): any {
  try {
    const [header, data, signature] = token.split(".");
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${data}`).digest("base64url");
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
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
    const existing = await query("SELECT id FROM users WHERE email = '" + email.replace(/'/g, "''") + "'");
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "Email is already registered" });
    }

    const userId = crypto.randomUUID();
    const businessId = crypto.randomUUID();
    const hashedPassword = hashPassword(password);

    // Create Business (Starter tier by default)
    await query(`
      INSERT INTO businesses (id, name, category, tier)
      VALUES ('${businessId}', '${businessName.replace(/'/g, "''")}', '${category.replace(/'/g, "''")}', 'Starter')
    `);

    // Create User
    await query(`
      INSERT INTO users (id, name, email, password, business_id)
      VALUES ('${userId}', '${name.replace(/'/g, "''")}', '${email.replace(/'/g, "''")}', '${hashedPassword}', '${businessId}')
    `);

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
    const hashedPassword = hashPassword(password);
    const users = await query(`
      SELECT u.id as userId, u.name, u.email, u.business_id as businessId, b.name as businessName, b.category, b.tier
      FROM users u
      LEFT JOIN businesses b ON u.business_id = b.id
      WHERE u.email = '${email.replace(/'/g, "''")}' AND u.password = '${hashedPassword}'
    `);

    if (!users || users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];
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
    const users = await query(`
      SELECT u.id as userId, u.name, u.email, u.business_id as businessId, b.name as businessName, b.category, b.tier
      FROM users u
      LEFT JOIN businesses b ON u.business_id = b.id
      WHERE u.id = '${userId}'
    `);

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];
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
    const posts = await query(`SELECT * FROM posts WHERE business_id = '${businessId}' ORDER BY created_at DESC`);
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Generate Social Posts using AI
app.post("/api/ai/generate-posts", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;

  try {
    const businesses = await query(`SELECT name, category FROM businesses WHERE id = '${businessId}'`);
    if (!businesses || businesses.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    const { name, category } = businesses[0];
    const generatedPosts = await generateSocialPosts(businessId, category, name);

    res.status(201).json({
      message: "Successfully generated 3 social posts",
      posts: generatedPosts
    });
  } catch (err) {
    console.error("AI Generation Route Error:", err);
    res.status(500).json({ error: "Failed to generate posts with AI" });
  }
});

// AI Chatbot Route
app.post("/api/ai/chat", async (req, res) => {
  const { businessId, conversationId, message } = req.body;

  if (!businessId || !conversationId || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const response = await chatWithAI(businessId, conversationId, message);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: "Chat failed" });
  }
});

// Get Chat History for Business
app.get("/api/ai/chat/history", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const history = await query(`
      SELECT conversation_id, role, content, created_at 
      FROM chat_messages 
      WHERE business_id = '${businessId}' 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
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

// Get Reviews for Business (with optional request link info)
app.get("/api/reviews", authenticate, async (req, res) => {
  const { businessId } = (req as any).user;
  try {
    const reviews = await query(`
      SELECT r.*, rr.shareable_token as request_token
      FROM reviews r
      LEFT JOIN review_requests rr ON r.request_id = rr.id
      WHERE r.business_id = '${businessId}'
      ORDER BY r.created_at DESC
    `);
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

    await query(`
      INSERT INTO review_requests (id, business_id, customer_name, customer_email, customer_phone, shareable_token, method, status)
      VALUES ('${id}', '${businessId}', '${customerName.replace(/'/g, "''")}', ${customerEmail ? `'${customerEmail.replace(/'/g, "''")}'` : "NULL"}, ${customerPhone ? `'${customerPhone.replace(/'/g, "''")}'` : "NULL"}, '${shareableToken}', '${sendMethod}', 'pending')
    `);

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
    const requests = await query(`
      SELECT rr.*, 
        (SELECT COUNT(*) FROM reviews r WHERE r.request_id = rr.id) as review_count
      FROM review_requests rr
      WHERE rr.business_id = '${businessId}'
      ORDER BY rr.created_at DESC
    `);

    const baseUrl = getBaseUrl(req);
    const enriched = requests.map((r: any) => ({
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
    const stats = await query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'sent' OR sent_at IS NOT NULL THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'reviewed' OR reviewed_at IS NOT NULL THEN 1 ELSE 0 END) as reviewed_count,
        SUM(CASE WHEN status = 'pending' AND sent_at IS NULL THEN 1 ELSE 0 END) as pending_count
      FROM review_requests
      WHERE business_id = '${businessId}'
    `);

    const data = stats[0] || { total_requests: 0, sent_count: 0, reviewed_count: 0, pending_count: 0 };
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
    const requests = await query(`SELECT id FROM review_requests WHERE id = '${id}' AND business_id = '${businessId}'`);
    if (!requests || requests.length === 0) {
      return res.status(404).json({ error: "Review request not found" });
    }

    await query(`
      UPDATE review_requests SET sent_at = datetime('now'), status = 'sent'
      WHERE id = '${id}'
    `);

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
    const requests = await query(`
      SELECT rr.id, rr.customer_name, rr.status, rr.reviewed_at, b.name as business_name, b.category
      FROM review_requests rr
      JOIN businesses b ON rr.business_id = b.id
      WHERE rr.shareable_token = '${token}'
    `);

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

    const request = requests[0];

    if (request.status === "reviewed") {
      return res.send(`
        <!DOCTYPE html>
        <html><head><title>Review Already Submitted</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#1e293b;border-radius:1rem;padding:2rem;max-width:400px;text-align:center;border:1px solid #334155}
        h1{color:#22c55e} p{color:#94a3b8}</style></head>
        <body><div class="card"><h1>✅ Review Already Submitted</h1><p>Thank you, ${request.customer_name}! You've already left a review for <strong>${request.business_name}</strong>.</p></div></body>
        </html>
      `);
    }

    // Serve the review submission form
    res.send(`
      <!DOCTYPE html>
      <html><head>
        <title>Leave a Review - ${request.business_name}</title>
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
            <div class="business-badge">${request.business_name} (${request.category})</div>
            <h1>Hi ${request.customer_name}!</h1>
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
                '<div class="success"><h2>✅ Thank You!</h2><p>Your review for <strong>${request.business_name}</strong> has been submitted. We really appreciate your feedback!</p></div>';
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
    const requests = await query(`
      SELECT id, business_id, customer_name, status FROM review_requests
      WHERE shareable_token = '${token}'
    `);

    if (!requests || requests.length === 0) {
      return res.status(404).json({ error: "Review request not found" });
    }

    const request_ = requests[0];

    if (request_.status === "reviewed") {
      return res.status(400).json({ error: "Review already submitted for this request" });
    }

    const reviewId = crypto.randomUUID();
    const sanitizedComment = comment ? comment.replace(/'/g, "''") : "";

    // Insert the review
    await query(`
      INSERT INTO reviews (id, business_id, customer_name, rating, comment, status, request_id)
      VALUES ('${reviewId}', '${request_.business_id}', '${request_.customer_name.replace(/'/g, "''")}', ${rating}, '${sanitizedComment}', 'published', '${request_.id}')
    `);

    // Mark the request as reviewed
    await query(`
      UPDATE review_requests SET status = 'reviewed', reviewed_at = datetime('now')
      WHERE id = '${request_.id}'
    `);

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
    // Forward to the new system
    const id = crypto.randomUUID();
    const shareableToken = crypto.randomBytes(16).toString("hex");

    await query(`
      INSERT INTO review_requests (id, business_id, customer_name, shareable_token, method, status)
      VALUES ('${id}', '${businessId}', '${customerName.replace(/'/g, "''")}', '${shareableToken}', 'link', 'pending')
    `);

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

// Serve Static Frontend Assets in Production
const frontendDistPath = path.join(process.cwd(), "../frontend/dist");
app.use(express.static(frontendDistPath));

// Fallback all non-API GET requests to React's index.html
app.get("*", (req, res) => {
  if (!req.url.startsWith("/api") && !req.url.startsWith("/r/")) {
    res.sendFile(path.join(frontendDistPath, "index.html"), (err) => {
      if (err) {
        res.status(404).send("Site is building, please refresh in a moment!");
      }
    });
  } else if (!req.url.startsWith("/api")) {
    return;
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// Start Server bound publicly to 0.0.0.0
app.listen(PORT, "0.0.0.0", () => {
  console.log(`GrowLocal AI Server is live on port ${PORT} bound to all interfaces.`);
});