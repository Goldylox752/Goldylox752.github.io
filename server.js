const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// --------------------
// STRIPE PLACEHOLDER ROUTE
// --------------------
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    // replace with real Stripe logic
    res.json({
      url: "https://your-checkout-link-here"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// BASIC VERIFY ROUTE (optional)
// --------------------
app.post("/api/verify-session", async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.json({ valid: false });
  }

  // replace with Stripe verification later
  return res.json({ valid: true });
});

// --------------------
// FRONTEND ENTRY
// --------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

module.exports = app;

// MUST be last route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
