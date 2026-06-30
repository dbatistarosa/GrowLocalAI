import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";
import { chatWithAI, supportChatWithAI } from "../ai.js";
import { generateId } from "../lib/utils.js";

const router = Router();

async function handleChatActions(businessId: string, response: string) {
  if (response.includes("[BOOKING:")) {
    try {
      const bookingJson = response.match(/\[BOOKING:(.*?)\]/)?.[1];
      if (bookingJson) {
        const bookingData = JSON.parse(bookingJson);
        const bookingId = generateId();
        await query(`INSERT INTO bookings (id, business_id, customer_name, customer_phone, service_id, date, time, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [bookingId, businessId, bookingData.name || "", bookingData.phone || "", bookingData.service || "", bookingData.date || "", bookingData.time || ""]);
      }
    } catch (e) { console.error("Booking parse error:", e); }
  }
  return response.replace(/\[BOOKING:.*?\]/, "").trim();
}

router.post("/ai/chat", async (req, res) => {
  const { businessId, conversationId, message } = req.body;
  if (!businessId || !conversationId || !message) return res.status(400).json({ error: "Missing required fields" });
  try {
    const rawResponse = await chatWithAI(businessId, conversationId, message);
    const response = await handleChatActions(businessId, rawResponse);
    res.json({ response });
  } catch (err) { res.status(500).json({ error: "Chat failed" }); }
});

router.post("/ai/chat/instagram", async (req, res) => {
  const { businessId, senderId, message } = req.body;
  const rawResponse = await chatWithAI(businessId, senderId, message, 'instagram');
  const response = await handleChatActions(businessId, rawResponse);
  res.json({ response });
});

router.post("/ai/chat/whatsapp", async (req, res) => {
  const { businessId, senderId, message } = req.body;
  const rawResponse = await chatWithAI(businessId, senderId, message, 'whatsapp');
  const response = await handleChatActions(businessId, rawResponse);
  res.json({ response });
});

router.get("/ai/chat/history", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const history = await query(`SELECT conversation_id, role, content, created_at FROM chat_messages WHERE business_id = ? ORDER BY created_at DESC LIMIT 100`, [businessId]);
    res.json(history);
  } catch (err) { res.status(500).json({ error: "Failed to fetch chat history" }); }
});

router.get("/ai/chatbot/snippet", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const host = req.get("host") || "localhost:3000";
  const baseUrl = `${req.protocol}://${host}`;
  const snippet = `<!-- GrowLocal AI Chatbot --><script>window.GROWLOCAL_CONFIG={businessId:"${businessId}",baseUrl:"${baseUrl}"};</script><script src="${baseUrl}/chatbot.js" async></script><!-- End GrowLocal AI Chatbot -->`.trim();
  res.json({ snippet });
});

router.patch("/ai/chatbot/config", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { config } = req.body;
  if (!config) return res.status(400).json({ error: "Missing config data" });
  try {
    const configString = JSON.stringify(config);
    await query(`UPDATE businesses SET chatbot_config = ? WHERE id = ?`, [configString, businessId]);
    res.json({ message: "Chatbot configuration updated successfully" });
  } catch (err) { console.error("Update chatbot config error:", err); res.status(500).json({ error: "Failed to update chatbot configuration" }); }
});

// Support chat and tickets
router.post("/support/chat", authenticate, async (req, res) => {
  const { userId } = req.user!;
  const { conversationId, message } = req.body;
  try {
    const response = await supportChatWithAI(userId, conversationId, message);
    if (response.includes("[TICKET:")) {
      try {
        const ticketJson = response.match(/\[TICKET:(.*?)\]/)?.[1];
        if (ticketJson) {
          const ticketData = JSON.parse(ticketJson);
          const ticketId = generateId();
          await query(`INSERT INTO support_tickets (id, user_id, subject, description, priority, status) VALUES (?, ?, ?, ?, ?, 'Open')`,
            [ticketId, userId, ticketData.subject || "AI Support Request", `Opened via AI Support Bot. Last message: ${message}`, ticketData.priority || "Medium"]);
        }
      } catch (e) {}
    }
    res.json({ response: response.replace(/\[TICKET:.*?\]/, "").trim() });
  } catch (err) { res.status(500).json({ error: "Support chat failed" }); }
});

router.get("/support/tickets", authenticate, async (req, res) => {
  const { userId } = req.user!;
  const tickets = await query(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
  res.json(tickets);
});

router.post("/support/tickets", authenticate, async (req, res) => {
  const { userId } = req.user!;
  const { subject, description, priority } = req.body;
  const id = generateId();
  try {
    await query(`INSERT INTO support_tickets (id, user_id, subject, description, priority, status) VALUES (?, ?, ?, ?, ?, 'Open')`, [id, userId, subject, description, priority || "Medium"]);
    res.status(201).json({ id, subject });
  } catch (err) { res.status(500).json({ error: "Failed to create ticket" }); }
});

export default router;