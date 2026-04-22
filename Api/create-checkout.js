import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { plan } = req.body;

  const priceMap = {
    starter: 9900,
    pro: 29900,
    elite: 99900
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'cad',
        product_data: { name: `NorthSky ${plan}` },
        unit_amount: priceMap[plan],
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://your-site.vercel.app/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://your-site.vercel.app',
  });

  res.status(200).json({ url: session.url });
}