import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";

const router = Router();

router.get("/integrations/status", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const connections = await query(`SELECT platform, connected, username, connected_at, expires_at FROM social_connections WHERE business_id = ?`, [businessId]);
    res.json({
      integrations: [
        { platform: "instagram", name: "Instagram", connected: (connections || []).some((c: any) => c.platform === "instagram" && c.connected), enabled: true, docsUrl: "https://developers.facebook.com/docs/instagram-basic-display-api/", credentialsNeeded: ["Instagram App ID", "Instagram App Secret"] },
        { platform: "google_business_profile", name: "Google Business Profile", connected: (connections || []).some((c: any) => c.platform === "google_business_profile" && c.connected), enabled: true, docsUrl: "https://developers.google.com/my-business", credentialsNeeded: ["Google Cloud Project ID", "OAuth Client ID", "OAuth Client Secret"] },
        { platform: "twilio", name: "Twilio (SMS & WhatsApp)", connected: (connections || []).some((c: any) => c.platform === "twilio" && c.connected), enabled: true, docsUrl: "https://www.twilio.com/docs", credentialsNeeded: ["Twilio Account SID", "Twilio Auth Token", "Twilio Phone Number"] }
      ], details: connections || []
    });
  } catch (err) { console.error("Integration status error:", err); res.status(500).json({ error: "Failed to fetch integration status" }); }
});

router.get("/integrations/instagram/connect", authenticate, async (req, res) => {
  const host = req.get("host") || "localhost:3000";
  const baseUrl = `${req.protocol}://${host}`;
  res.json({ message: "Instagram connection stub", oauthUrl: `https://api.instagram.com/oauth/authorize?client_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(`${baseUrl}/api/integrations/instagram/callback`)}&scope=user_profile,user_media&response_type=code`, status: "requires_app_credentials", credentialsNeeded: ["Instagram App ID", "Instagram App Secret"] });
});

router.get("/integrations/instagram/callback", async (req, res) => {
  const { code } = req.query;
  res.json({ message: "Instagram OAuth callback received", code: code ? "received" : "missing", nextStep: "Exchange code for access token", status: "stub_mode" });
});

router.get("/integrations/gbp/connect", authenticate, async (req, res) => {
  const host = req.get("host") || "localhost:3000";
  const baseUrl = `${req.protocol}://${host}`;
  res.json({ message: "GBP connection stub", oauthUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=${encodeURIComponent(`${baseUrl}/api/integrations/gbp/callback`)}&scope=https://www.googleapis.com/auth/business.manage&response_type=code&access_type=offline`, status: "requires_google_credentials", credentialsNeeded: ["Google Cloud Project ID", "OAuth Client ID", "OAuth Client Secret"] });
});

router.get("/integrations/gbp/callback", async (req, res) => {
  const { code } = req.query;
  res.json({ message: "GBP OAuth callback received", code: code ? "received" : "missing", nextStep: "Exchange code for access + refresh tokens", status: "stub_mode" });
});

router.get("/integrations/twilio/status", authenticate, async (req, res) => {
  res.json({ message: "Twilio integration stub", status: "requires_credentials", configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN), credentialsNeeded: ["Twilio Account SID", "Twilio Auth Token", "Twilio Phone Number"], note: "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env to activate" });
});

export default router;