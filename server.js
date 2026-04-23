const express = require("express");
const path = require("path");

const app = express();

/**
 * =========================
 * STRIPE WEBHOOK MUST BE FIRST
 * =========================
 */
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    let event;

    try {
      event = JSON.parse(req.body);
    } catch (err) {
      return res.status(400).send("Webhook error");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      console.log("PAYMENT SUCCESS:", session.customer_email);
    }

    res.json({ received: true });
  }
);

/**
 * =========================
 * NORMAL MIDDLEWARE
 * =========================
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/**
 * =========================
 * API ROUTES
 * =========================
 */

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/create-checkout-session", (req, res) => {
  const { plan } = req.body;

  // placeholder (replace with Stripe later)
  res.json({
    url: `/?session_id=fake_${plan}_${Date.now()}`
  });
});

app.post("/api/verify-session", (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.json({ valid: false });
  }

  return res.json({
    valid: true,
    plan: "pro"
  });
});

/**
 * =========================
 * FRONTEND ROUTES
 * =========================
 */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/**
 * EXPORT (MUST BE LAST)
 */
module.exports = app;