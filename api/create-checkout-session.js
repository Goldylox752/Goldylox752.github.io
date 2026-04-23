import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { plan } = req.body || {};

    const prices = {
      starter: process.env.STRIPE_PRICE_STARTER,
      pro: process.env.STRIPE_PRICE_PRO,
      elite: process.env.STRIPE_PRICE_ELITE,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: prices[plan], quantity: 1 }],
      success_url: `${process.env.BASE_URL}/?success=true`,
      cancel_url: `${process.env.BASE_URL}/?canceled=true`,
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}