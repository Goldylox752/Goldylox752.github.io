import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    const { plan, successUrl, cancelUrl, userId } = req.body;

    if (!plan || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const priceMap = {
      starter: 9900,
      pro: 29900,
      elite: 99900,
    };

    if (!priceMap[plan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      mode: "payment", // keep this for now (one-time)

      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: `NorthSky ${plan.toUpperCase()} Plan`,
            },
            unit_amount: priceMap[plan],
          },
          quantity: 1,
        },
      ],

      // 🔥 critical for verification
      metadata: {
        plan,
        userId,
      },

      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
}