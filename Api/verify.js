app.post('/api/webhook', rawBody, (req, res) => {
  const event = stripe.webhooks.constructEvent(...);

  if (event.type === 'checkout.session.completed') {
    // mark user as active in DB
  }

  if (event.type === 'customer.subscription.deleted') {
    // revoke access
  }
});
