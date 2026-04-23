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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      customer_email: email || undefined, // 🔥 THIS FIXES YOUR ISSUE

      line_items: [
        {
          price: prices[plan],
          quantity: 1,
        },
      ],

      success_url: `${process.env.APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/cancel`,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Checkout failed" });
  }
}