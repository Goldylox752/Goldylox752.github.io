import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const charges = await stripe.charges.list({ limit: 100 });
  const totalRevenue = charges.data.filter(c=>c.paid&&!c.refunded).reduce((sum,c)=>sum+c.amount,0)/100;
  const totalSIMsSold = charges.data.filter(c=>c.paid&&!c.refunded).length;
  const customers = await stripe.customers.list({ limit: 100 });
  res.status(200).json({
    totalRevenue,
    totalSIMsSold,
    activeUsers: customers.data.length,
    newSignups: customers.data.length
  });
}