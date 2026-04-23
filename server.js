const express = require("express");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

/**
 * =========================
 * API ROUTES
 * =========================
 */

// Health check (for testing deployment)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running"
  });
});

/**
 * Example Stripe checkout placeholder
 * Replace this with real Stripe logic later
 */
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    // TODO: integrate Stripe here
    res.json({
      success: true,
      url: "https://your-checkout-link-here"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * Example session verification placeholder
 */
app.post("/api/verify-session", (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.json({ valid: false });
  }

  // TODO: verify with Stripe or DB
  return res.json({ valid: true });
});

/**
 * =========================
 * FRONTEND ROUTES
 * =========================
 */

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Catch-all (IMPORTANT for Vercel + SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Export for Vercel
module.exports = app;

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), (req, res) => {
  const event = JSON.parse(req.body);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // SAVE USER AS ACTIVE
    console.log("PAYMENT SUCCESS:", session.customer_email);
  }

  res.json({ received: true });
});
