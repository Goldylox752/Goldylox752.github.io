const express = require("express");
const stripe = require("stripe")("sk_live_YourSecretKeyHere");
const app = express();
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  const cartItems = req.body.cart;

  const line_items = cartItems.map(item => ({
    price_data: {
      currency: "cad",
      product_data: { name: item.name },
      unit_amount: item.priceCAD * 100
    },
    quantity: 1
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items,
    mode: "payment",
    success_url: "https://goldylox752.github.io/success.html",
    cancel_url: "https://goldylox752.github.io"
  });

  res.json({ url: session.url });
});

app.listen(4242, () => console.log("Server running on port 4242"));