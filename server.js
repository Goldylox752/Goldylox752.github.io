const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Stripe example endpoint
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    res.json({ url: "https://example-checkout-link" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Server running");
});

module.exports = app;