import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// helper: raw body
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // ✅ PAYMENT SUCCESS
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = session.customer_details?.email || session.customer_email;
      const plan = session.metadata?.plan || "unknown";
      const amount = session.amount_total / 100;

      console.log("💰 Payment received:", email, plan);

      // =========================
      // 1. SAVE PAYMENT
      // =========================
      await supabase.from("payments").insert([
        {
          email,
          plan,
          amount,
          stripe_session: session.id,
          created_at: new Date().toISOString(),
        },
      ]);

      // =========================
      // 2. SAVE SESSION
      // =========================
      await supabase.from("verified_sessions").insert([
        {
          session_id: session.id,
          email,
          plan,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ]);

      // =========================
      // 3. UPSERT USER
      // =========================
      await supabase.from("users").upsert([
        {
          email,
          updated_at: new Date().toISOString(),
        },
      ]);

      console.log("✅ Supabase sync complete for:", email);
    }

    res.json({ received: true });

  } catch (err) {
    console.error("❌ Sync error:", err);
    res.status(500).json({ error: err.message });
  }
}