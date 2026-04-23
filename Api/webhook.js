import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false, // IMPORTANT for Stripe signature verification
  },
};

// helper to read raw body
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
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // =========================
  // ✅ EVENT HANDLING CORE
  // =========================

  switch (event.type) {

    // 🟢 FIRST PAYMENT COMPLETED
    case "checkout.session.completed": {
      const session = event.data.object;

      console.log("✅ Checkout completed:", session.id);

      // TODO: SAVE TO DB (IMPORTANT)
      await saveOrUpdateUser({
        userId: session.metadata?.userId,
        customerId: session.customer,
        subscriptionId: session.subscription,
        status: "active",
        plan: session.metadata?.plan || "starter"
      });

      break;
    }

    // 🔁 SUBSCRIPTION UPDATED
    case "customer.subscription.updated": {
      const sub = event.data.object;

      console.log("🔁 Subscription updated:", sub.id);

      await updateSubscription({
        customerId: sub.customer,
        status: sub.status,
        plan: sub.items.data[0]?.price?.nickname || "pro"
      });

      break;
    }

    // 🔴 SUBSCRIPTION CANCELED
    case "customer.subscription.deleted": {
      const sub = event.data.object;

      console.log("❌ Subscription canceled:", sub.id);

      await updateSubscription({
        customerId: sub.customer,
        status: "canceled"
      });

      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}

/* =========================
   DATABASE PLACEHOLDERS
   (replace with Supabase / Mongo / Postgres)
========================= */

async function saveOrUpdateUser(data) {
  console.log("DB SAVE:", data);
  // INSERT OR UPDATE USER
}

async function updateSubscription(data) {
  console.log("DB UPDATE:", data);
  // UPDATE USER SUBSCRIPTION STATUS
}