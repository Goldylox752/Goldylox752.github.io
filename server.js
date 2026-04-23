const express = require("express");
const path = require("path");

const app = express();

/**
 * =========================
 * SAFE ENV CHECKS
 * =========================
 */
const stripeKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let stripe = null;
let supabase = null;

if (stripeKey) {
  const Stripe = require("stripe");
  stripe = new Stripe(stripeKey);
}

if (supabaseUrl && supabaseKey) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * =========================
 * MIDDLEWARE
 * =========================
 */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * =========================
 * HEALTH CHECK (DEBUG)
 * =========================
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    stripe: !!stripe,
    supabase: !!supabase
  });
});

/**
 * =========================
 * CHECKOUT
 * =========================
 */
app.post("/api/create-checkout-session", async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const { plan } = req.body;

  const prices = {
    starter: "price_xxx",
    pro: "price_xxx",
    elite: "price_xxx"
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: prices[plan], quantity: 1 }],
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
 * VERIFY SESSION
 * =========================
 */
app.post("/api/verify-session", async (req, res) => {
  if (!supabase) {
    return res.json({ valid: false });
  }

  const { email } = req.body;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("subscribed", true)
    .single();

  res.json({
    valid: !!data,
    plan: data?.plan || null
  });
});

/**
 * =========================
 * WEBHOOK (SAFE VERSION)
 * =========================
 */
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const event = JSON.parse(req.body);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        if (supabase) {
          await supabase.from("users").upsert({
            id: session.customer,
            email: session.customer_details?.email,
            plan: session.metadata?.plan || "pro",
            subscribed: true
          });
        }
      }

      res.json({ received: true });

    } catch (err) {
      res.status(400).send("Webhook error");
    }
  }
);

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