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


/ /activate-sim
app.post('/activate-sim', async (req, res) => {
  const { wallet, tokenId } = req.body;

  // 1. Verify NFT ownership ON-CHAIN
  const owner = await contract.ownerOf(tokenId);

  if (owner.toLowerCase() !== wallet.toLowerCase()) {
    return res.status(403).json({ error: "Not NFT owner" });
  }

  // 2. Check if already activated
  const { data } = await supabase
    .from('nfts')
    .select('*')
    .eq('token_id', tokenId)
    .single();

  if (data.activated) {
    return res.status(400).json({ error: "Already used" });
  }

  // 3. Activate SIM (your logic here)
  const simId = "SIM-" + tokenId;

  // 4. Save activation
  await supabase
    .from('nfts')
    .update({
      activated: true,
      sim_id: simId,
      activated_at: new Date().toISOString()
    })
    .eq('token_id', tokenId);

  res.json({ success: true, simId });
});














