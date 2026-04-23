import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on("data", (c) => chunks.push(c));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  const buf = await buffer(req);

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🔥 PAYMENT SUCCESS (MAIN EVENT)
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const plan = session.metadata.plan;
    const customer = session.customer;

    // 👉 HERE is where you'd:
    // - save user in DB
    // - mark subscription active
    // - assign plan

    console.log("PAID USER:", {
      customer,
      plan,
    });
  }

  return res.json({ received: true });
}
