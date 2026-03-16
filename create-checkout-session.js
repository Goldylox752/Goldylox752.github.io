import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'cad',
        product_data: { name: 'SIM2Door $20 Prepaid SIM Card' },
        unit_amount: 2000,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://YOUR-GITHUB-PAGES-SITE/?success=true',
    cancel_url: 'https://YOUR-GITHUB-PAGES-SITE/',
  });
  res.status(200).json({ id: session.id });
}