import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sessionId = req.query.session_id;

  if (!sessionId) {
    return res.status(200).json({ paid: false });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  res.status(200).json({
    paid: session.payment_status === 'paid'
  });
}