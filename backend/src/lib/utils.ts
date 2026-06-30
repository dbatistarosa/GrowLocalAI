import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const JWT_SECRET: string = process.env.JWT_SECRET || "growlocal-production-secret-key-2026-change-me";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function signToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getBaseUrl(req: any): string {
  const host = req.get("host") || "localhost:3000";
  return `${req.protocol}://${host}`;
}

export function getTierFromPrice(amountCents: number): string {
  if (amountCents === 14999) return "Starter";
  if (amountCents === 49999) return "Pro";
  if (amountCents === 99999) return "Premium";
  if (amountCents === 9900) return "Starter";
  if (amountCents === 29900) return "Pro";
  if (amountCents === 59900) return "Premium";
  return "Starter";
}

export const PLAN_LIMITS: Record<string, number> = {
  Starter: 12, Pro: 30, Premium: 999999
};

export const STRIPE_PLANS = {
  Starter: { id: "Starter", price: 149.99, priceId: "price_1TjPVMDwVs5LOLSiu0vA3lKA", checkoutUrl: "https://buy.stripe.com/28EdR96thgBo2LIb0m2go03", features: ["12 AI Social Posts/mo", "Automated Review Requests", "Basic Website Chatbot", "1 Instagram Connection"] },
  Pro: { id: "Pro", price: 499.99, priceId: "price_1TjPVMDwVs5LOLSiewrI25j5", checkoutUrl: "https://buy.stripe.com/cNi00jdVJetg1HE9Wi2go04", features: ["30 AI Social Posts/mo", "AI Instagram DM Chatbot", "WhatsApp Automation", "GBP Management", "SEO Dashboard", "Calendar Reservations"] },
  Premium: { id: "Premium", price: 999.99, priceId: "price_1TjPVMDwVs5LOLSiNDtJVWPv", checkoutUrl: "https://buy.stripe.com/aFa3cv8Bpad0euq8Se2go05", features: ["Unlimited AI Posts", "AI Video Creation", "Human Review of Content", "Competitor Tracking", "Income Tracking", "Priority Support"] }
};

export const TIER_LIMITS = {
  Starter: { label: "Starter", postsPerMonth: 12, videosPerMonth: 0, chatbotCount: 1, instagramConnections: 1, gbpManagement: false, calendar: false, whatsapp: false, competitorTracking: false, incomeTracking: false, tabs: ["overview", "social", "reviews", "support", "faq", "settings"] },
  Pro: { label: "Pro", postsPerMonth: 30, videosPerMonth: 0, chatbotCount: 1, instagramConnections: 1, gbpManagement: true, calendar: true, whatsapp: true, competitorTracking: false, incomeTracking: false, tabs: ["overview", "social", "reviews", "chatbot", "seo", "support", "faq", "settings"] },
  Premium: { label: "Premium", postsPerMonth: -1, videosPerMonth: -1, chatbotCount: -1, instagramConnections: -1, gbpManagement: true, calendar: true, whatsapp: true, competitorTracking: true, incomeTracking: true, tabs: ["overview", "social", "reviews", "chatbot", "seo", "competitors", "income", "support", "faq", "settings"] }
};

export function generateId(): string {
  return crypto.randomUUID();
}