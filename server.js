const express = require("express");
const path = require("path");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * =========================
 * STRIPE WEBHOOK (AUTO UNLOCK)
 * =========================
 */
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      event = JSON.parse(req.body);
    } catch {
      return res.status(400).send("Webhook error");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = session.customer_details?.email;
      const plan = session.metadata?.plan || "pro";

      // SAVE / UPDATE USER
      await supabase.from("users").upsert({
        id: session.customer,
        email,
        plan,
        subscribed: true,
        stripe_customer_id: session.customer
      });

      // LOG REVENUE
      await supabase.from("revenue_logs").insert([
        {
          email,
          plan,
          amount: session.amount_total / 100
        }
      ]);
    }

    res.json({ received: true });
  }
);

/**
 * =========================
 * JSON MIDDLEWARE
 * =========================
 */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/**
 * =========================
 * CREATE STRIPE CHECKOUT
 * =========================
 */
app.post("/api/create-checkout-session", async (req, res) => {
  const { plan } = req.body;

  const prices = {
    starter: "price_xxx",
    pro: "price_xxx",
    elite: "price_xxx"
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: prices[plan],
        quantity: 1
      }
    ],
    metadata: {
      plan
    },
    success_url: `${process.env.BASE_URL}/?success=1`,
    cancel_url: `${process.env.BASE_URL}/`
  });

  res.json({ url: session.url });
});

/**
 * =========================
 * VERIFY LOGIN / UNLOCK
 * =========================
 */
app.post("/api/verify-session", async (req, res) => {
  const { email } = req.body;

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
 * ADMIN DASHBOARD API
 * =========================
 */
app.get("/api/admin/stats", async (req, res) => {
  const { data } = await supabase.from("revenue_logs").select("*");

  const total = data.reduce((sum, r) => sum + r.amount, 0);

  res.json({
    revenue: total,
    transactions: data.length
  });
});

/**
 * =========================
 * FRONTEND
 * =========================
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

module.exports = app;