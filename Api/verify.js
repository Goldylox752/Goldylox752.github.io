import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ valid: false, error: "Missing session_id" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    // ✅ SUCCESS CONDITION
    if (session.payment_status === "paid") {
      return res.status(200).json({
        valid: true,
        plan: session.metadata.plan || "starter",
      });
    }

    return res.status(200).json({ valid: false });

  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ valid: false });
  }
}