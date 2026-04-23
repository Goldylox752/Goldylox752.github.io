const express = require("express");
const path = require("path");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const app = express();

/**
 * ENV SAFETY
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * =========================
 * STRIPE WEBHOOK (TRUTH SOURCE)
 * =========================
 */
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      event = JSON.parse(req.body);
    } catch (err) {
      return res.status(400).send("Webhook error");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = session.customer_details?.email;
      const customerId = session.customer;
      const plan = session.metadata?.plan || "pro";

      if (email) {
        await supabase.from("users").upsert({
          id: customerId,
          email,
          plan,
          subscribed: true,
          stripe_customer_id: customerId,
          updated_at: new Date()
        });
      }
    }

    res.json({ received: true });
  }
);

/**
 * =========================
 * MIDDLEWARE
 * =========================
 */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * =========================
 * CREATE CHECKOUT SESSION
 * =========================
 */
const prices = {
  starter: "price_xxx",
  pro: "price_xxx",
  elite: "price_xxx"
};

app.post("/api/create-checkout-session", async (req, res) => {
  const { plan } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: prices[plan],
          quantity: 1
        }
      ],
      success_url: `${process.env.BASE_URL}/?success=1`,
      cancel_url: `${process.env.BASE_URL}/`,
      metadata: { plan }
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * UNLOCK CHECK (REAL SOURCE OF TRUTH)
 * =========================
 */
app.post("/api/verify-session", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.json({ valid: false });
  }

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("subscribed", true)
    .single();

  if (!data) {
    return res.json({ valid: false });
  }

  res.json({
    valid: true,
    plan: data.plan
  });
});

/**
 * =========================
 * HEALTH CHECK
 * =========================
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
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

module.exports = app;