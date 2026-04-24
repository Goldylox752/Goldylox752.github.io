import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.send("NorthSky Backend Running 🚀");
});

/* ================= STRIPE CHECKOUT ================= */
app.post("/api/create-checkout", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "RoofFlow Lead Access",
            },
            unit_amount: 100000,
          },
          quantity: 1,
        },
      ],
      success_url: "https://your-site.com/success",
      cancel_url: "https://your-site.com/cancel",
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

/* ================= EVENTS TRACKING ================= */
app.post("/api/events", (req, res) => {
  console.log("📊 Event:", req.body);

  res.json({ ok: true });
});

/* ================= LEAD STORAGE ================= */
app.post("/api/leads", async (req, res) => {
  const lead = req.body;

  console.log("📥 Lead received:", lead);

  // OPTIONAL: push to Supabase here later

  res.json({ success: true });
});

/* ================= STRIPE WEBHOOK ================= */
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      console.log("💰 Payment success:", event.data.object);
    }

    res.json({ received: true });
  }
);

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
