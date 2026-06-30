import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

// Lightweight .env loader
try {
  const envPath = path.join(process.cwd(), "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...valueParts] = trimmed.split("=");
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  }
} catch (err) {
  console.warn("Failed to load .env file:", err);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Import and mount all route modules
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import reviewRoutes from "./routes/reviews.js";
import bookingRoutes from "./routes/bookings.js";
import billingRoutes from "./routes/billing.js";
import chatbotRoutes from "./routes/chatbot.js";
import seoRoutes from "./routes/seo.js";
import adminRoutes from "./routes/admin.js";
import integrationRoutes from "./routes/integrations.js";
import settingsRoutes from "./routes/settings.js";

// Mount all routes under /api
app.use("/api", authRoutes);
app.use("/api", postRoutes);
app.use("/api", reviewRoutes);
app.use("/api", bookingRoutes);
app.use("/api", billingRoutes);
app.use("/api", chatbotRoutes);
app.use("/api", seoRoutes);
app.use("/api", adminRoutes);
app.use("/api", integrationRoutes);
app.use("/api", settingsRoutes);

// Serve Static Frontend Assets in Production
const frontendDistPath = path.join(process.cwd(), "../frontend/dist");
app.use(express.static(frontendDistPath));

// Fallback all non-API GET requests to React's index.html
app.get("*", (req, res) => {
  if (!req.url.startsWith("/api") && !req.url.startsWith("/r/") && !req.url.startsWith("/billing/")) {
    res.sendFile(path.join(frontendDistPath, "index.html"), (err) => {
      if (err) res.status(404).send("Site is building, please refresh in a moment!");
    });
  }
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`GrowLocal AI Server is live on port ${PORT} bound to all interfaces.`);
});