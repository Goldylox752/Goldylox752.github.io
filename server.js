require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "Web Development Service", description: "$300 one-time service" },
          unit_amount: 30000, // $300 in cents
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${process.env.DOMAIN_URL}/success.html`,
      cancel_url: `${process.env.DOMAIN_URL}/cancel.html`,
    });

    res.json({ id: session.id, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));