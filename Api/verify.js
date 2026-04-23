import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ valid: false, error: "Method not allowed" });
    }

    const { session_id } = req.body;

    if (!session_id || typeof session_id !== "string") {
      return res.status(400).json({
        valid: false,
        error: "Invalid or missing session_id",
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // 🔒 Ensure session exists + paid
    if (!session || session.payment_status !== "paid") {
      return res.status(200).json({ valid: false });
    }

    // 🔒 Extra safety: ensure metadata exists
    const plan = session.metadata?.plan || "starter";

    return res.status(200).json({
      valid: true,
      plan,
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err.message);

    return res.status(500).json({
      valid: false,
      error: "Verification failed",
    });
  }
}