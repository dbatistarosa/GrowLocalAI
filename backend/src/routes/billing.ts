import { Router, raw } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";
import { STRIPE_PLANS, TIER_LIMITS, generateId } from "../lib/utils.js";

const router = Router();

router.get("/billing/plans", (_req, res) => {
  res.json({ plans: Object.values(STRIPE_PLANS), public: Object.entries(STRIPE_PLANS).map(([key, plan]) => ({ id: plan.id, name: key, price: plan.price, checkoutUrl: plan.checkoutUrl, features: plan.features })) });
});

router.get("/billing/status", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const businesses = await query(`SELECT tier, stripe_customer_id, stripe_subscription_id, stripe_subscription_status FROM businesses WHERE id = ?`, [businessId]);
    if (!businesses || businesses.length === 0) return res.status(404).json({ error: "Business not found" });
    const biz = businesses[0] as any;
    const plans = Object.values(STRIPE_PLANS).map(p => ({ id: p.id, name: p.id, price: p.price, checkoutUrl: p.checkoutUrl, features: p.features }));
    res.json({ currentPlan: biz.tier || "Starter", subscriptionStatus: biz.stripe_subscription_status || "incomplete", stripeCustomerId: biz.stripe_customer_id, stripeSubscriptionId: biz.stripe_subscription_id, plans, isActive: biz.stripe_subscription_status === "active" || biz.stripe_subscription_status === "trialing" || !biz.stripe_subscription_id });
  } catch (err) { console.error("Billing status error:", err); res.status(500).json({ error: "Failed to fetch billing status" }); }
});

router.post("/billing/create-checkout", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { planId } = req.body;
  if (!planId || !STRIPE_PLANS[planId as keyof typeof STRIPE_PLANS]) return res.status(400).json({ error: "Invalid plan. Choose Starter, Pro, or Premium." });
  try {
    const users = await query(`SELECT email FROM users WHERE business_id = ?`, [businessId]);
    const email = users && users.length > 0 ? (users[0] as any).email : "";
    const plan = STRIPE_PLANS[planId as keyof typeof STRIPE_PLANS];
    const host = req.get("host") || "localhost:3000";
    const baseUrl = `${req.protocol}://${host}`;
    const stripeCheckoutUrl = `${plan.checkoutUrl}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${businessId}&redirect_url=${encodeURIComponent(`${baseUrl}/billing/success?plan=${planId}&business_id=${businessId}`)}`;
    res.json({ url: stripeCheckoutUrl, plan: plan.id, price: plan.price });
  } catch (err) { console.error("Create checkout error:", err); res.status(500).json({ error: "Failed to create checkout session" }); }
});

router.get("/billing/success", async (req, res) => {
  const { plan, business_id } = req.query;
  if (plan && business_id) {
    try { await query(`UPDATE businesses SET tier = ?, stripe_subscription_status = 'active' WHERE id = ?`, [plan as string, business_id as string]); console.log(`Business ${business_id} upgraded to ${plan} plan`); }
    catch (err) { console.error("Failed to update tier after checkout:", err); }
  }
  res.redirect("/dashboard");
});

// Subscription limits
router.get("/subscription/limits", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const businesses = await query(`SELECT tier, subscription_current_period_start, subscription_current_period_end FROM businesses WHERE id = ?`, [businessId]);
    const biz = (businesses as any)?.[0] || { tier: "Starter" };
    const tier = (biz.tier as string) || "Starter";
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Starter;
    const now = new Date().toISOString().split("T")[0];
    const usage = await query(`SELECT feature, count_used, limit_amount FROM subscription_usage WHERE business_id = ? AND period_start <= ? AND period_end >= ?`, [businessId, now, now]);
    const usageMap: Record<string, any> = {};
    (usage || []).forEach((u: any) => { usageMap[u.feature] = { used: u.count_used, limit: u.limit_amount }; });
    res.json({ tier, limits, usage: usageMap, periodStart: biz.subscription_current_period_start, periodEnd: biz.subscription_current_period_end, tabs: limits.tabs });
  } catch (err) { console.error("Subscription limits error:", err); res.status(500).json({ error: "Failed to load limits" }); }
});

router.post("/subscription/usage/increment", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { feature } = req.body;
  if (!feature) return res.status(400).json({ error: "Feature name required" });
  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    const tier = (businesses?.[0] as any)?.tier || "Starter";
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Starter;
    const limitKey = `${feature}PerMonth` as keyof typeof limits;
    const limitAmount = (limits[limitKey] as number) ?? -1;
    if (limitAmount === 0) return res.status(403).json({ error: `${feature} not available on your ${tier} plan`, upgrade: true });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    const existing = await query(`SELECT id, count_used FROM subscription_usage WHERE business_id = ? AND feature = ? AND period_start = ?`, [businessId, feature, monthStart]);
    if (existing && existing.length > 0) {
      const current = existing[0] as any;
      if (limitAmount > 0 && current.count_used >= limitAmount) return res.status(403).json({ error: `Monthly ${feature} limit reached (${current.count_used}/${limitAmount})`, upgrade: true });
      await query(`UPDATE subscription_usage SET count_used = count_used + 1 WHERE id = ?`, [current.id]);
      res.json({ used: current.count_used + 1, limit: limitAmount });
    } else {
      const id = generateId();
      await query(`INSERT INTO subscription_usage (id, business_id, feature, period_start, period_end, count_used, limit_amount) VALUES (?, ?, ?, ?, ?, 1, ?)`, [id, businessId, feature, monthStart, monthEnd, limitAmount]);
      res.json({ used: 1, limit: limitAmount });
    }
  } catch (err) { console.error("Usage increment error:", err); res.status(500).json({ error: "Failed to update usage" }); }
});

router.post("/subscription/check-access", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { feature } = req.body;
  if (!feature) return res.status(400).json({ error: "Feature name required" });
  try {
    const businesses = await query(`SELECT tier FROM businesses WHERE id = ?`, [businessId]);
    const tier = (businesses?.[0] as any)?.tier || "Starter";
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.Starter;
    const boolKeys: Record<string, keyof typeof limits> = { "gbp": "gbpManagement", "calendar": "calendar", "whatsapp": "whatsapp", "competitors": "competitorTracking", "income": "incomeTracking" };
    const boolKey = boolKeys[feature];
    if (boolKey) return res.json({ feature, tier, hasAccess: limits[boolKey] === true, limit: limits[boolKey] === true ? -1 : 0 });
    const limitKey = `${feature}PerMonth` as keyof typeof limits;
    const limitAmount = (limits[limitKey] as number) ?? -1;
    res.json({ feature, tier, hasAccess: limitAmount !== 0, limit: limitAmount });
  } catch (err) { console.error("Access check error:", err); res.status(500).json({ error: "Failed to check access" }); }
});

// Stripe webhook
router.post("/stripe/webhook", raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("sk_live_placeholder")) {
    console.log("Webhook received (raw mode):", req.body.toString().substring(0, 200));
    return res.json({ received: true });
  }
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
    catch (err: any) { return res.status(400).send(`Webhook Error: ${err.message}`); }
    const getTier = (c: number) => { if (c === 14999) return "Starter"; if (c === 49999) return "Pro"; if (c === 99999) return "Premium"; if (c === 9900) return "Starter"; if (c === 29900) return "Pro"; if (c === 59900) return "Premium"; return "Starter"; };
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const businessId = session.client_reference_id;
        const tier = session.metadata?.tier || getTier(session.amount_subtotal);
        if (businessId) {
          await query(`UPDATE businesses SET tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, stripe_subscription_status = 'active' WHERE id = ?`, [tier, session.customer || "", session.subscription || "", businessId]);
          try {
            const transId = generateId();
            await query(`INSERT INTO platform_transactions (id, business_id, amount, currency, tier, stripe_payment_intent_id, status) VALUES (?, ?, ?, ?, ?, ?, 'completed')`, [transId, businessId, session.amount_total / 100, (session.currency?.toUpperCase() || 'USD'), tier, session.payment_intent || ""]);
          } catch (tErr) { console.error("Failed to log platform transaction:", tErr); }
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const businesses = await query(`SELECT id FROM businesses WHERE stripe_subscription_id = ?`, [subscription.id]);
        if (businesses && businesses.length > 0) await query(`UPDATE businesses SET stripe_subscription_status = ? WHERE id = ?`, [subscription.status, (businesses[0] as any).id]);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const businesses = await query(`SELECT id FROM businesses WHERE stripe_subscription_id = ?`, [invoice.subscription]);
        if (businesses && businesses.length > 0) await query(`UPDATE businesses SET stripe_subscription_status = 'past_due' WHERE id = ?`, [(businesses[0] as any).id]);
        break;
      }
    }
    res.json({ received: true });
  } catch (err) { console.error("Webhook error:", err); res.status(400).send(`Webhook Error: ${err}`); }
});

export default router;