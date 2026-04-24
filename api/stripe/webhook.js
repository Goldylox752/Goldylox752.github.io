import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: { bodyParser: false }
};

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
    console.error("Webhook error:", err.message);
    return res.status(400).send("Webhook Error");
  }

  // =========================
  // 💳 CHECKOUT COMPLETED
  // =========================
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const userId = session.metadata?.user_id;
    const plan = session.metadata?.plan;
    const credits = parseInt(session.metadata?.credits || "0");

    if (!userId) {
      console.error("Missing user_id in metadata");
      return res.status(400).json({ error: "Missing user_id" });
    }

    // -------------------------
    // 1. UPSERT SUBSCRIPTION
    // -------------------------
    const { error: subError } = await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: session.customer,
      plan: plan || "basic",
      status: "active",
      updated_at: new Date().toISOString()
    });

    if (subError) {
      console.error("Subscription error:", subError);
    }

    // -------------------------
    // 2. ADD SMS CREDITS (SAFE INCREMENT)
    // -------------------------
    if (credits > 0) {
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("sms_credits")
        .eq("user_id", userId)
        .single();

      const currentCredits = existing?.sms_credits || 0;

      const { error: creditError } = await supabase
        .from("subscriptions")
        .update({
          sms_credits: currentCredits + credits
        })
        .eq("user_id", userId);

      if (creditError) {
        console.error("Credit update error:", creditError);
      }
    }
  }

  // =========================
  // 🔄 RENEWALS
  // =========================
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;

    await supabase
      .from("subscriptions")
      .update({ status: "active" })
      .eq("stripe_customer_id", invoice.customer);
  }

  // =========================
  // ❌ CANCELS
  // =========================
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;

    await supabase
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("stripe_customer_id", sub.customer);
  }

  res.json({ received: true });
}

// =========================
async function buffer(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}