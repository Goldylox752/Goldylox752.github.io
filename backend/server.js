const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(express.json());
app.use(express.static('../frontend'));

// Stripe endpoints (/create-stripe-session, /verify-stripe-payment)
// Newton endpoints (/create-newton-payment, /newton-webhook)
// Same code we outlined earlier

const PORT = process.env.PORT || 4242;
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));