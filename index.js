import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   RATE LIMIT
========================= */

app.use(
  "/lead",
  rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: {
      success: false,
      error: "Too many requests. Please slow down."
    }
  })
);

/* =========================
   CORE SERVICES
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* EMAIL */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* TWILIO (SINGLE INSTANCE ONLY) */
const smsClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH
);

/* =========================
   SAFE SMS WRAPPER (IMPORTANT)
========================= */

async function sendSMS({ body, to }) {
  try {
    if (!to) return;

    await smsClient.messages.create({
      body,
      from: process.env.TWILIO_NUMBER,
      to
    });

  } catch (err) {
    console.error("📵 SMS FAILED:", err.message);
  }
}

/* =========================
   TEST ROUTE
========================= */

app.get("/test-sms", async (req, res) => {
  try {
    const msg = await smsClient.messages.create({
      body: "🚀 NorthSky SMS Test Successful",
      from: process.env.TWILIO_NUMBER,
      to: process.env.MY_PHONE
    });

    res.json({
      success: true,
      sid: msg.sid
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* =========================
   SCORE ENGINE
========================= */

function calculateLeadScore({ service, postalCode, source }) {
  let score = 0;

  if (service === "insurance claim") score += 8;
  if (service === "leak check") score += 6;
  if (service === "roof inspection") score += 5;

  if (source === "ad" || source === "kijiji") score += 3;

  if (postalCode?.startsWith("T")) score += 2;

  return score;
}

/* =========================
   CITY DETECTION
========================= */

function detectCity(postalCode) {
  if (!postalCode) return "unknown";

  if (postalCode.startsWith("T5")) return "Edmonton";
  if (postalCode.startsWith("T2")) return "Calgary";
  if (postalCode.startsWith("T9")) return "Fort McMurray";

  return "Alberta";
}

/* =========================
   CONTRACTOR LOOKUP
========================= */

async function getContractor(city) {
  const { data } = await supabase
    .from("contractors")
    .select("*")
    .eq("city", city)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  return data || null;
}

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    system: "NorthSky Revenue OS v5"
  });
});

/* =========================
   LEAD ENGINE
========================= */

app.post("/lead", async (req, res) => {
  try {
    const {
      name,
      contact,
      postalCode,
      service = "unknown",
      source = "direct",
      pageUrl = null
    } = req.body;

    /* VALIDATION */
    if (!contact || contact.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "Invalid contact information"
      });
    }

    const cleanContact = contact.trim();

    /* DUPLICATE CHECK */
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("contact", cleanContact)
      .maybeSingle();

    if (existing) {
      return res.json({
        success: true,
        message: "Lead already exists",
        leadId: existing.id
      });
    }

    /* SCORE + CITY */
    const score = calculateLeadScore({
      service,
      postalCode,
      source
    });

    const city = detectCity(postalCode);

    const leadId = uuidv4();

    /* CREATE LEAD */
    const { error } = await supabase.from("leads").insert([
      {
        id: leadId,
        name: name || null,
        contact: cleanContact,
        postal_code: postalCode || null,
        service,
        source,
        page_url: pageUrl,
        status: "new",
        score,
        city,
        locked: false,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    /* CONTRACTOR MATCH */
    const contractor = await getContractor(city);
    let assigned = false;

    /* OWNER ALERT */
    if (score >= 10) {
      await sendSMS({
        body: `🔥 HOT LEAD
${name} | ${cleanContact}
City: ${city}
Service: ${service}
Score: ${score}`,
        to: process.env.MY_PHONE
      });
    }

    /* CONTRACTOR ASSIGNMENT */
    if (contractor) {
      assigned = true;

      await supabase.from("lead_assignments").insert([
        {
          id: uuidv4(),
          lead_id: leadId,
          contractor_id: contractor.id,
          city,
          price: contractor.price_per_lead,
          status: "assigned",
          created_at: new Date().toISOString()
        }
      ]);

      await sendSMS({
        body: `📍 NEW LEAD - ${city}
${name} | ${cleanContact}
Service: ${service}
Price: $${contractor.price_per_lead}
Score: ${score}`,
        to: contractor.phone
      });
    }

    /* EMAIL ALERT */
    await transporter.sendMail({
      from: "NorthSky Leads <your@email.com>",
      to: process.env.ALERT_EMAIL,
      subject: `🚨 NEW LEAD (${city} | ${score})`,
      text: `
Lead ID: ${leadId}
Name: ${name}
Contact: ${cleanContact}
City: ${city}
Service: ${service}
Source: ${source}
Score: ${score}
Assigned: ${assigned}
      `
    });

    /* RESPONSE */
    return res.status(201).json({
      success: true,
      leadId,
      score,
      city,
      assigned,
      message: "Lead processed successfully"
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 NorthSky Revenue OS v5 running on port ${PORT}`);
});