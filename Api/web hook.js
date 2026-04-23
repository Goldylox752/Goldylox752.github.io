import Stripe from "stripe";
import getRawBody from "raw-body";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// IMPORTANT: disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];

  let event;

  try {
    // Get raw request body (required for Stripe signature verification)
    const rawBody = await getRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🎯 HANDLE EVENTS
  try {
    switch (event.type) {

      // 💳 Payment completed (most important)
      case "checkout.session.completed": {
        const session = event.data.object;

        console.log("✅ Checkout completed:", session.id);

        // Example: unlock user account
        // session.customer_email
        // session.metadata.plan

        break;
      }

      // 📦 Subscription created
      case "customer.subscription.created": {
        const subscription = event.data.object;

        console.log("📦 Subscription created:", subscription.id);

        break;
      }

      // 🔄 Subscription updated
      case "customer.subscription.updated": {
        console.log("🔄 Subscription updated");
        break;
      }

      // ❌ Payment failed
      case "invoice.payment_failed": {
        const invoice = event.data.object;

        console.log("❌ Payment failed:", invoice.id);

        // Example: revoke access here

        break;
      }

      // 💰 Payment succeeded
      case "invoice.paid": {
        console.log("💰 Invoice paid");
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (err) {
    console.error("Webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
