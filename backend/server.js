const express = require("express");
const app = express();

/**
 * 1. JSON middleware (for normal routes)
 */
app.use(express.json());

/**
 * 2. Stripe webhook (RAW body ONLY)
 */
app.post("/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    console.log("WEBHOOK");
    res.json({ received: true });
  }
);

/**
 * 3. Normal API routes
 */
app.post("/api/event", (req, res) => {
  console.log("EVENT:", req.body);
  res.json({ ok: true });
});

/**
 * 4. Start server
 */
app.listen(3000, () => {
  console.log("NorthSky backend running on :3000");
});