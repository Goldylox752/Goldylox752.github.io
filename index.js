const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const twilio = require("twilio");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   ENV CHECK
========================= */
const required = ["SUPABASE_URL", "SUPABASE_KEY", "STRIPE_SECRET"];
required.forEach(k => {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
});

/* =========================
   RATE LIMIT
========================= */
app.use("/lead", rateLimit({
  windowMs: 60 * 1000,
  max: 20
}));

/* =========================
   SERVICES
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET);

const sms = process.env.TWILIO_SID
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH)
  : null;

/* =========================
   HELPERS
========================= */
function cleanContact(contact) {
  return contact.trim().toLowerCase();
}

function scoreLead({ service, source, postalCode }) {
  let score = 0;

  if (service.includes("inspection")) score += 5;
  if (service.includes("repair")) score += 7;
  if (service.includes("replacement")) score += 10;

  if (source === "ad") score += 5;
  if (postalCode?.startsWith("T")) score += 3;

  return score;
}

function getCity(postal) {
  if (!postal) return "unknown";
  if (postal.startsWith("T5")) return "Edmonton";
  if (postal.startsWith("T2")) return "Calgary";
  return "Alberta";
}

async function getBuyer(city) {
  const { data } = await supabase
    .from("contractors")
    .select("*")
    .eq("city", city)
    .eq("active", true)
    .order("price_per_lead", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/* =========================
   💳 CHARGE CONTRACTOR
========================= */
async function chargeContractor(buyer, amount, leadId) {
  if (!buyer.stripe_customer_id || !buyer.default_payment_method) {
    throw new Error("No payment method");
  }

  const payment = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency: "cad",
    customer: buyer.stripe_customer_id,
    payment_method: buyer.default_payment_method,
    off_session: true,
    confirm: true,
    metadata: {
      lead_id: leadId,
      contractor_id: buyer.id
    }
  });

  return payment;
}

/* =========================
   LEAD ENDPOINT
========================= */
app.post("/lead", async (req, res) => {
  try {
    const {
      name,
      contact,
      postalCode,
      service = "unknown",
      source = "direct",
      siteId = "unknown",
      pageUrl = null
    } = req.body;

    if (!contact || contact.length < 5) {
      return res.status(400).json({ success: false });
    }

    const clean = cleanContact(contact);

    /* DUPLICATE CHECK */
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("contact", clean)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, leadId: existing.id });
    }

    /* SCORE + CITY */
    const score = scoreLead({ service, source, postalCode });
    const city = getCity(postalCode);
    const leadId = uuidv4();

    /* FIND BUYER FIRST (IMPORTANT) */
    const buyer = await getBuyer(city);

    let revenue = 0;
    let charged = false;

    if (buyer) {
      revenue = buyer.price_per_lead;

      /* 🔥 TRY CHARGE BEFORE COMMITTING */
      try {
        await chargeContractor(buyer, revenue, leadId);
        charged = true;
      } catch (err) {
        console.error("❌ PAYMENT FAILED:", err.message);

        /* disable contractor */
        await supabase
          .from("contractors")
          .update({ active: false })
          .eq("id", buyer.id);
      }
    }

    /* SAVE LEAD */
    await supabase.from("leads").insert([{
      id: leadId,
      name,
      contact: clean,
      postal_code: postalCode,
      service,
      source,
      site_id: siteId,
      page_url: pageUrl,
      score,
      city,
      status: charged ? "sold" : "new",
      created_at: new Date().toISOString()
    }]);

    /* ASSIGN ONLY IF PAID */
    if (buyer && charged) {
      await supabase.from("lead_assignments").insert([{
        id: uuidv4(),
        lead_id: leadId,
        contractor_id: buyer.id,
        price: revenue,
        city,
        status: "paid"
      }]);

      if (sms && buyer.phone) {
        await sms.messages.create({
          body: `🔥 PAID LEAD\n${service} | ${city}\n${contact}\n$${revenue}`,
          from: process.env.TWILIO_NUMBER,
          to: buyer.phone
        });
      }
    }

    return res.json({
      success: true,
      leadId,
      score,
      city,
      revenue,
      charged
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   CONTRACTOR SIGNUP
========================= */
app.post("/contractor/signup", async (req, res) => {
  try {
    const { name, email, phone, city } = req.body;

    const customer = await stripe.customers.create({
      email,
      name,
      phone
    });

    const { data } = await supabase
      .from("contractors")
      .insert([{
        id: uuidv4(),
        name,
        email,
        phone,
        city,
        stripe_customer_id: customer.id,
        active: true,
        price_per_lead: 50
      }])
      .select()
      .single();

    res.json({ success: true, contractorId: data.id });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* =========================
   START
========================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("💰 NorthSky Lead Engine LIVE (Payments Enabled)");
});