import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const priceMap = {
  starter: "price_xxx",
  pro: "price_xxx",
  elite: "price_xxx",
};

export default async function handler(req, res) {
  try {
    const { plan } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceMap[plan],
          quantity: 1,
        },
      ],
      success_url: `${req.body.successUrl}`,
      cancel_url: `${req.body.cancelUrl}`,
      metadata: {
        plan,
      },
    });

    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
