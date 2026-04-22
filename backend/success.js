app.get('/verify-session', async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

  if (session.payment_status === 'paid') {
    res.json({ paid: true });
  } else {
    res.json({ paid: false });
  }
});