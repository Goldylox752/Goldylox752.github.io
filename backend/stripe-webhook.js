app.post("/api/stripe/webhook",
express.raw({ type: "application/json" }),
(req, res) => {

  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    sessions[session.id] = {
      valid: true,
      plan: session.amount_total >= 99900 ? "elite"
          : session.amount_total >= 29900 ? "pro"
          : "starter"
    };
  }

  res.json({ received: true });
});