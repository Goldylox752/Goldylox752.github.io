import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { userId, credits } = req.body;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${credits} SMS Credits`
          },
          unit_amount: credits * 5 // 5 cents per SMS credit
        },
        quantity: 1
      }
    ],
    metadata: {
      user_id: userId,
      credits
    },
    success_url: `${process.env.DOMAIN}/dashboard?sms=success`,
    cancel_url: `${process.env.DOMAIN}/dashboard`
  });

  res.json({ url: session.url });
}