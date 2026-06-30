import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { query } from "../db.js";
import { generateId } from "../lib/utils.js";

const router = Router();

router.get("/bookings", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const bookings = await query(
      `SELECT b.*, s.name as service_name, s.price as service_price FROM bookings b LEFT JOIN services s ON b.service_id = s.id WHERE b.business_id = ? ORDER BY b.date ASC, b.time ASC`, [businessId]);
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: "Failed to fetch bookings" }); }
});

router.post("/bookings", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { customerName, customerEmail, customerPhone, serviceId, date, time, status } = req.body;
  if (!customerName || !date || !time) return res.status(400).json({ error: "Customer name, date, and time are required" });
  try {
    const id = generateId();
    const bookingStatus = status || "confirmed";
    await query(`INSERT INTO bookings (id, business_id, customer_name, customer_email, customer_phone, service_id, date, time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, businessId, customerName, customerEmail || null, customerPhone || null, serviceId || null, date, time, bookingStatus]);
    res.status(201).json({ id, customerName, customerEmail, customerPhone, serviceId, date, time, status: bookingStatus });
  } catch (err) { res.status(500).json({ error: "Failed to create booking" }); }
});

router.patch("/bookings/:id", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status is required" });
  try {
    const booking = await query(`SELECT * FROM bookings WHERE id = ? AND business_id = ?`, [id, businessId]);
    if (!booking || booking.length === 0) return res.status(404).json({ error: "Booking not found" });
    await query(`UPDATE bookings SET status = ? WHERE id = ? AND business_id = ?`, [status, id, businessId]);
    if (status === 'completed') {
      const serviceId = (booking[0] as any).service_id;
      const services = await query(`SELECT price FROM services WHERE name = ? OR id = ?`, [serviceId, serviceId]);
      const price = (services[0] as any)?.price || 0;
      const incomeId = generateId();
      await query(`INSERT INTO income (id, business_id, booking_id, amount, status) VALUES (?, ?, ?, ?, 'received')`, [incomeId, businessId, id, price]);
    }
    res.json({ message: "Booking updated" });
  } catch (err) { res.status(500).json({ error: "Update failed" }); }
});

router.get("/income", authenticate, async (req, res) => {
  const { businessId } = req.user!;
  try {
    const income = await query(`SELECT * FROM income WHERE business_id = ? ORDER BY created_at DESC`, [businessId]);
    const total = await query(`SELECT SUM(amount) as total FROM income WHERE business_id = ?`, [businessId]);
    res.json({ history: income, total: (total[0] as any)?.total || 0 });
  } catch (err) { res.status(500).json({ error: "Failed to fetch income" }); }
});

export default router;