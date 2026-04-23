const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

dotenv.config();

const app = express();

/* =========================
   CORE CLIENTS
========================= */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("NorthSky API running");
});

/* =========================
   STRIPE CHECKOUT SESSION
   (ONLY PAYMENT FLOW)
========================= */
const PLAN_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
  elite: process.env.STRIPE_ELITE_PRICE_ID,
};

app.post("/api/create-checkout", async (req, res) => {
  try {
    const { plan, successUrl, cancelUrl, userId } = req.body;

    if (!PLAN_PRICE_IDS[plan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: PLAN_PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan,
        userId: userId || "anonymous",
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   STRIPE WEBHOOK
   (ONLY TRUSTED SOURCE)
========================= */
app.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          const plan = session.metadata?.plan || "starter";
          const userId = session.metadata?.userId || "anonymous";

          await supabase.from("verified_sessions").upsert({
            session_id: session.id,
            user_id: userId,
            plan,
            expires_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            created_at: new Date().toISOString(),
          });

          console.log("✅ Payment verified:", session.id);
          break;
        }

        case "customer.subscription.deleted": {
          const session = event.data.object;

          await supabase
            .from("verified_sessions")
            .delete()
            .eq("session_id", session.id);

          console.log("❌ Subscription cancelled:", session.id);
          break;
        }

        default:
          console.log("Unhandled event:", event.type);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).send("Webhook processing failed");
    }
  }
);

/* =========================
   VERIFY ACCESS (FRONTEND)
========================= */
app.post("/api/verify", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.json({ valid: false });
    }

    const { data, error } = await supabase
      .from("verified_sessions")
      .select("*")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("Verify error:", error);
      return res.json({ valid: false });
    }

    return res.json({
      valid: !!data,
      plan: data?.plan || null,
    });
  } catch (err) {
    console.error("Verify exception:", err);
    res.json({ valid: false });
  }
});

/* =========================
   EVENT LOGGING (OPTIONAL)
========================= */
app.post("/api/event", (req, res) => {
  console.log("Event:", req.body);
  res.json({ ok: true });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 NorthSky API running on port ${PORT}`);
});