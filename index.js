const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   ENV CHECK
========================= */
const required = ["SUPABASE_URL", "SUPABASE_KEY"];
required.forEach(k => {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
});

/* =========================
   RATE LIMIT (PROTECT $$$)
========================= */
app.use("/lead", rateLimit({
  windowMs: 60 * 1000,
  max: 15
}));

/* =========================
   SERVICES
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const sms = process.env.TWILIO_SID
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH)
  : null;

/* =========================
   SCORE ENGINE
========================= */
function scoreLead({ service, source, postalCode }) {
  let score = 0;

  if (service.includes("inspection")) score += 5;
  if (service.includes("repair")) score += 7;
  if (service.includes("replacement")) score += 10;

  if (source === "ad") score += 5;
  if (postalCode?.startsWith("T")) score += 3;

  return score;
}

/* =========================
   CITY DETECTION
========================= */
function getCity(postal) {
  if (!postal) return "unknown";
  if (postal.startsWith("T5")) return "Edmonton";
  if (postal.startsWith("T2")) return "Calgary";
  return "Alberta";
}

/* =========================
   CONTRACTOR MATCH
========================= */
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
   LEAD ENDPOINT (MONEY CORE)
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

    /* DUPLICATE CHECK */
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("contact", contact)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, leadId: existing.id });
    }

    /* SCORE + GEO */
    const score = scoreLead({ service, source, postalCode });
    const city = getCity(postalCode);
    const leadId = uuidv4();

    /* SAVE LEAD */
    await supabase.from("leads").insert([{
      id: leadId,
      name,
      contact,
      postal_code: postalCode,
      service,
      source,
      site_id: siteId, // 🔥 MONEY TRACKING
      page_url: pageUrl,
      score,
      city,
      status: "new",
      created_at: new Date().toISOString()
    }]);

    /* FIND BUYER */
    const buyer = await getBuyer(city);
    let revenue = 0;

    if (buyer) {
      revenue = buyer.price_per_lead;

      await supabase.from("lead_assignments").insert([{
        id: uuidv4(),
        lead_id: leadId,
        contractor_id: buyer.id,
        price: revenue,
        city
      }]);

      /* SEND SMS TO BUYER */
      if (sms && buyer.phone) {
        await sms.messages.create({
          body: `NEW LEAD: ${service} | ${city}\n${contact}\n$${revenue}`,
          from: process.env.TWILIO_NUMBER,
          to: buyer.phone
        });
      }
    }

    /* 🔥 RETURN MONEY DATA */
    return res.json({
      success: true,
      leadId,
      score,
      city,
      revenue,
      site: siteId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* =========================
   START
========================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("💰 NorthSky Lead Engine LIVE");
});