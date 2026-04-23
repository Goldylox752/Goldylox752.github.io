import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    const { session_id } = req.body;

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session) {
      return res.json({ valid: false });
    }

    return res.json({
      valid: true,
      plan: session.metadata?.plan || "starter",
      token: session.customer,
    });
  } catch (err) {
    return res.json({ valid: false });
  }
}
