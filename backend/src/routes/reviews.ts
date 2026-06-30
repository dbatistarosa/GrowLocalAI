import { Router } from "express";
import crypto from "crypto";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";
import { getBaseUrl, generateId } from "../lib/utils.js";

const router = Router();

router.get("/reviews", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const reviews = await query(
      `SELECT r.*, rr.shareable_token as request_token FROM reviews r LEFT JOIN review_requests rr ON r.request_id = rr.id WHERE r.business_id = ? ORDER BY r.created_at DESC`,
      [businessId]
    );
    res.json(reviews);
  } catch (err) { res.status(500).json({ error: "Failed to fetch reviews" }); }
});

router.post("/review-requests", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { customerName, customerEmail, customerPhone, method } = req.body;
  if (!customerName) return res.status(400).json({ error: "Customer name is required" });
  try {
    const id = generateId();
    const shareableToken = crypto.randomBytes(16).toString("hex");
    const sendMethod = method || "link";
    await query(`INSERT INTO review_requests (id, business_id, customer_name, customer_email, customer_phone, shareable_token, method, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, businessId, customerName, customerEmail || null, customerPhone || null, shareableToken, sendMethod]);
    const baseUrl = getBaseUrl(req);
    const shareableLink = `${baseUrl}/r/${shareableToken}`;
    res.status(201).json({ id, customerName, shareableLink, shareableToken, method: sendMethod, status: "pending", message: `Review request created. Share this link: ${shareableLink}` });
  } catch (err) { console.error("Create review request error:", err); res.status(500).json({ error: "Failed to create review request" }); }
});

router.get("/review-requests", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const requests = await query(
      `SELECT rr.*, (SELECT COUNT(*) FROM reviews r WHERE r.request_id = rr.id) as review_count FROM review_requests rr WHERE rr.business_id = ? ORDER BY rr.created_at DESC`, [businessId]);
    const baseUrl = getBaseUrl(req);
    const enriched = (requests as any[]).map((r) => ({ ...r, shareableLink: `${baseUrl}/r/${r.shareable_token}` }));
    res.json(enriched);
  } catch (err) { console.error("Fetch review requests error:", err); res.status(500).json({ error: "Failed to fetch review requests" }); }
});

router.get("/review-requests/stats", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const stats = await query(
      `SELECT COUNT(*) as total_requests, SUM(CASE WHEN status = 'sent' OR sent_at IS NOT NULL THEN 1 ELSE 0 END) as sent_count, SUM(CASE WHEN status = 'reviewed' OR reviewed_at IS NOT NULL THEN 1 ELSE 0 END) as reviewed_count, SUM(CASE WHEN status = 'pending' AND sent_at IS NULL THEN 1 ELSE 0 END) as pending_count FROM review_requests WHERE business_id = ?`, [businessId]);
    const data = (stats[0] as any) || { total_requests: 0, sent_count: 0, reviewed_count: 0, pending_count: 0 };
    data.conversion_rate = data.total_requests > 0 ? Math.round((data.reviewed_count / data.total_requests) * 100) : 0;
    res.json(data);
  } catch (err) { console.error("Review request stats error:", err); res.status(500).json({ error: "Failed to fetch stats" }); }
});

router.patch("/review-requests/:id/track-sent", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { id } = req.params;
  try {
    const requests = await query(`SELECT id FROM review_requests WHERE id = ? AND business_id = ?`, [id, businessId]);
    if (!requests || requests.length === 0) return res.status(404).json({ error: "Review request not found" });
    await query(`UPDATE review_requests SET sent_at = datetime('now'), status = 'sent' WHERE id = ? AND business_id = ?`, [id, businessId]);
    res.json({ message: "Review request marked as sent" });
  } catch (err) { res.status(500).json({ error: "Failed to update review request" }); }
});

router.post("/reviews/request", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { customerName } = req.body;
  if (!customerName) return res.status(400).json({ error: "Customer name is required" });
  try {
    const id = generateId();
    const shareableToken = crypto.randomBytes(16).toString("hex");
    await query(`INSERT INTO review_requests (id, business_id, customer_name, shareable_token, method, status) VALUES (?, ?, ?, ?, 'link', 'pending')`, [id, businessId, customerName, shareableToken]);
    const baseUrl = getBaseUrl(req);
    const shareableLink = `${baseUrl}/r/${shareableToken}`;
    res.status(201).json({ message: "Review request created successfully", id, shareableLink, customerName });
  } catch (err) { console.error("Legacy review request error:", err); res.status(500).json({ error: "Failed to create review request" }); }
});

router.get("/r/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const requests = await query(
      `SELECT rr.id, rr.customer_name, rr.status, rr.reviewed_at, b.name as business_name, b.category FROM review_requests rr JOIN businesses b ON rr.business_id = b.id WHERE rr.shareable_token = ?`, [token]);
    if (!requests || requests.length === 0) return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Review Not Found</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:#1e293b;border-radius:1rem;padding:2rem;max-width:400px;text-align:center;border:1px solid #334155}h1{color:#94a3b8}p{color:#64748b}</style></head><body><div class="card"><h1>🔗 Link Not Found</h1><p>This review request link is invalid or has expired.</p></div></body></html>`);
    const request = requests[0] as any;
    const safeName = request.customer_name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeBusinessName = request.business_name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeCategory = (request.category || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (request.status === "reviewed") return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Review Already Submitted</title></head><body><div class="card"><h1>✅ Review Already Submitted</h1><p>Thank you, ${safeName}! You've already left a review.</p></div></body></html>`);
    // Serve review submission form (HTML escaped values, inline the same form as before)
    res.send(`<!DOCTYPE html><html><head><title>Leave a Review - ${safeBusinessName}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem}.card{background:#1e293b;border-radius:1rem;padding:2rem;max-width:480px;width:100%;border:1px solid #334155;box-shadow:0 20px 60px rgba(0,0,0,.5)}h1{font-size:1.5rem;margin:0 0 .25rem;color:#f8fafc}.subtitle{color:#94a3b8;font-size:.9rem;margin-bottom:1.5rem}.rating-select{display:flex;gap:.5rem;justify-content:center;margin-bottom:1.5rem}.star-btn{background:0;border:2px solid #334155;border-radius:.75rem;padding:.5rem .75rem;cursor:pointer;font-size:1.5rem;transition:all .15s}.star-btn:hover,.star-btn.selected{border-color:#a855f7;background:#a855f710}.star-btn.selected{background:#a855f720}label{display:block;font-size:.85rem;font-weight:600;color:#94a3b8;margin-bottom:.5rem}textarea{width:100%;background:#0f172a;border:1px solid #334155;border-radius:.75rem;padding:.75rem;color:#f8fafc;font-size:.95rem;resize:vertical;font-family:inherit}textarea:focus{outline:none;border-color:#a855f7}button[type=submit]{width:100%;background:#a855f7;color:#fff;border:none;border-radius:.75rem;padding:.85rem;font-size:1rem;font-weight:700;cursor:pointer;transition:background .15s;margin-top:1rem}button[type=submit]:hover{background:#9333ea}button[type=submit]:disabled{opacity:.5;cursor:not-allowed}.success{text-align:center}.success h2{color:#22c55e;font-size:1.3rem}.success p{color:#94a3b8;font-size:.9rem}.error{color:#ef4444;font-size:.85rem;margin-top:.5rem}.business-badge{display:inline-block;background:#a855f715;color:#a855f7;border:1px solid #a855f730;border-radius:.5rem;padding:.25rem .75rem;font-size:.8rem;font-weight:600;margin-bottom:.75rem}</style></head><body><div class="card" id="app"><div style="text-align:center"><div class="business-badge">${safeBusinessName} (${safeCategory})</div><h1>Hi ${safeName}!</h1><p class="subtitle">How was your experience? Leave a review below.</p></div><form id="reviewForm"><div class="rating-select" id="ratingSelect">${[1,2,3,4,5].map(n => `<button type="button" class="star-btn" data-rating="${n}">${'⭐'.repeat(n)}</button>`).join('')}</div><label for="comment">Your Review</label><textarea id="comment" rows="3" placeholder="Tell us about your experience..." required></textarea><div id="formError" class="error" style="display:none"></div><button type="submit" id="submitBtn">Submit Review</button></form></div><script>let selectedRating=0;document.querySelectorAll('.star-btn').forEach(b=>{b.addEventListener('click',()=>{selectedRating=parseInt(b.dataset.rating);document.querySelectorAll('.star-btn').forEach(s=>s.classList.toggle('selected',parseInt(s.dataset.rating)<=selectedRating))})});document.getElementById('reviewForm').addEventListener('submit',async e=>{e.preventDefault();if(selectedRating===0){alert('Please select a rating');return}const c=document.getElementById('comment').value;const b=document.getElementById('submitBtn');b.disabled=true;b.textContent='Submitting...';try{const r=await fetch('/api/r/${token}/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating:selectedRating,comment:c})});if(!r.ok)throw Error();document.getElementById('app').innerHTML='<div class="success"><h2>✅ Thank You!</h2><p>Your review for <strong>${safeBusinessName}</strong> has been submitted.</p></div>'}catch{document.getElementById('formError').textContent='Failed to submit.';document.getElementById('formError').style.display='block';b.disabled=false;b.textContent='Submit Review'}});</script></body></html>`);
  } catch (err) { console.error("Public review page error:", err); res.status(500).send("Error loading review page."); }
});

router.post("/r/:token/submit", async (req, res) => {
  const { token } = req.params;
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be between 1 and 5" });
  try {
    const requests = await query(`SELECT id, business_id, customer_name, status FROM review_requests WHERE shareable_token = ?`, [token]);
    if (!requests || requests.length === 0) return res.status(404).json({ error: "Review request not found" });
    const request_ = requests[0] as any;
    if (request_.status === "reviewed") return res.status(400).json({ error: "Review already submitted for this request" });
    const reviewId = generateId();
    await query(`INSERT INTO reviews (id, business_id, customer_name, rating, comment, status, request_id) VALUES (?, ?, ?, ?, ?, 'published', ?)`, [reviewId, request_.business_id, request_.customer_name, rating, comment || "", request_.id]);
    await query(`UPDATE review_requests SET status = 'reviewed', reviewed_at = datetime('now') WHERE id = ?`, [request_.id]);
    res.status(201).json({ message: "Review submitted successfully", id: reviewId });
  } catch (err) { console.error("Review submission error:", err); res.status(500).json({ error: "Failed to submit review" }); }
});

export default router;