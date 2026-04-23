import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 REAL STRIPE PRICE IDS (create these in Stripe dashboard)
const priceMap = {
  starter: "price_xxx_starter",
  pro: "price_xxx_pro",
  elite: "price_xxx_elite",
};

export default async function handler(req, res) {
  try {
    const { plan, successUrl, cancelUrl, userId } = req.body;

    if (!plan || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!priceMap[plan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      // 🔥 SaaS MODE (THIS IS IMPORTANT)
      mode: "subscription",

      line_items: [
        {
          price: priceMap[plan],
          quantity: 1,
        },
      ],

      // 🔐 REQUIRED FOR WEBHOOK + DB SYNC
      metadata: {
        plan,
        userId: userId || "anonymous",
      },

      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
