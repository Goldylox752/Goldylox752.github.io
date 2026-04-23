import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default async function handler(req, res) {
  try {
    const { plan, email } = req.body;

    const prices = {
      basic: "price_xxx_basic",
      pro: "price_xxx_pro",
      enterprise: "price_xxx_enterprise",
    };

    if (!prices[plan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      // 🔥 THIS FIXES YOUR EMAIL PROBLEM
      customer_email: email || undefined,

      line_items: [
        {
          price: prices[plan],
          quantity: 1,
        },
      ],

      // 🔥 IMPORTANT FOR WEBHOOK TRACKING
      metadata: {
        plan: plan,
        email: email || "",
      },

      success_url: `${process.env.APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/cancel`,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
}