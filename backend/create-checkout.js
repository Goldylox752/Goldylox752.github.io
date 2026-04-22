const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/create-checkout', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'cad',
        product_data: { name: 'NorthSky License' },
        unit_amount: 10000,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: 'https://your-site.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://your-site.com/cancel',
  });

  res.json({ url: session.url });
});