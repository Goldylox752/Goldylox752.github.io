require("dotenv").config();

const express = require("express");
const axios = require("axios");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(express.json());
app.use(express.static("../frontend"));

/* =========================
   SUPABASE INIT (FIXED ORDER)
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   AUTOPILOT CONFIG
========================= */

const AUTOPILOT = {
  hotThreshold: 15,
  enableSMS: false,
  enableEmail: false,
  enableAI: false
};

/* =========================
   HOT LEAD PIPELINE (CORE MONEY ENGINE)
========================= */

app.post("/api/hot-lead", async (req, res) => {

  try {

    const lead = req.body;

    if (!lead) {
      return res.status(400).json({ error: "Missing lead payload" });
    }

    /* =========================
       1. STORE LEAD
    ========================= */

    await supabase.from("hot_leads").insert([{
      ...lead,
      created_at: new Date().toISOString()
    }]);

    console.log("🔥 HOT LEAD RECEIVED:", lead.user_id || lead.user);

    /* =========================
       2. AUTOPILOT ACTION LAYER
    ========================= */

    const actions = [];

    // CRM / DB sync
    actions.push("stored");

    // SMS (Twilio placeholder)
    if (AUTOPILOT.enableSMS) {
      actions.push("sms_triggered");
      // await sendSMS(lead)
    }

    // Email sequence (SendGrid placeholder)
    if (AUTOPILOT.enableEmail) {
      actions.push("email_sequence_started");
      // await sendEmail(lead)
    }

    // AI follow-up agent (optional)
    if (AUTOPILOT.enableAI) {
      actions.push("ai_agent_triggered");
      // await runAIAgent(lead)
    }

    // Stripe conversion routing (future upgrade hook)
    actions.push("conversion_ready");

    /* =========================
       RESPONSE
    ========================= */

    return res.json({
      ok: true,
      status: "routed",
      actions
    });

  } catch (err) {
    console.error("HOT LEAD ERROR:", err.message);
    return res.status(500).json({ error: "server_error" });
  }
});

/* =========================
   CHECKOUT SESSION (STRIPE)
========================= */

app.post("/api/create-checkout", async (req, res) => {

  try {

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: req.body.items.map(i => ({
        price_data: {
          currency: "cad",
          product_data: { name: i.name },
          unit_amount: i.price * 100
        },
        quantity: 1
      })),
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "stripe_failed" });
  }
});

/* =========================
   SIM ACTIVATION (NFT GATED)
========================= */

app.post("/api/activate-sim", async (req, res) => {

  try {

    const { wallet, tokenId, contract } = req.body;

    if (!wallet || !tokenId) {
      return res.status(400).json({ error: "missing_params" });
    }

    /* =========================
       1. VERIFY OWNERSHIP (PLACEHOLDER)
    ========================= */

    // NOTE: contract.ownerOf should be injected via ethers contract instance
    // const owner = await contract.ownerOf(tokenId);

    // if (owner.toLowerCase() !== wallet.toLowerCase()) {
    //   return res.status(403).json({ error: "not_owner" });
    // }

    /* =========================
       2. CHECK EXISTING RECORD
    ========================= */

    const { data: existing } = await supabase
      .from("nfts")
      .select("*")
      .eq("token_id", tokenId)
      .single();

    if (existing?.activated) {
      return res.status(400).json({ error: "already_activated" });
    }

    /* =========================
       3. ACTIVATE SIM
    ========================= */

    const simId = `SIM-${tokenId}`;

    await supabase.from("nfts").upsert([{
      token_id: tokenId,
      wallet,
      sim_id: simId,
      activated: true,
      activated_at: new Date().toISOString()
    }]);

    return res.json({
      success: true,
      simId
    });

  } catch (err) {
    console.error("SIM ERROR:", err.message);
    return res.status(500).json({ error: "activation_failed" });
  }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    system: "NorthSky Revenue OS Backend"
  });
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 4242;

app.listen(PORT, () => {
  console.log(`🚀 NorthSky server running on port ${PORT}`);
});