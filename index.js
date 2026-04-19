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

const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: "Too many requests. Please slow down."
  }
});

app.use("/lead", leadLimiter);

/* =========================
   SUPABASE
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   EMAIL ALERTS (3CX BRIDGE)
========================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* =========================
   TWILIO SMS SYSTEM
========================= */

const smsClient = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH
);

/* =========================
   SCORE ENGINE
========================= */

function calculateLeadScore({ service, postalCode, source }) {
  let score = 0;

  if (service === "insurance claim") score += 8;
  if (service === "leak check") score += 6;
  if (service === "roof inspection") score += 5;

  if (source === "ad" || source === "kijiji") score += 3;

  if (postalCode && postalCode.startsWith("T")) score += 2;

  return score;
}

/* =========================
   CITY DETECTION (FOR LEAD SELLING)
========================= */

function detectCity(postalCode) {
  if (!postalCode) return "unknown";

  if (postalCode.startsWith("T5")) return "Edmonton";
  if (postalCode.startsWith("T2")) return "Calgary";
  if (postalCode.startsWith("T9")) return "Fort McMurray";

  return "Alberta";
}

/* =========================
   GET CONTRACTOR BY CITY
========================= */

async function getContractor(city) {
  const { data } = await supabase
    .from("contractors")
    .select("*")
    .eq("city", city)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  return data;
}

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    system: "NorthSky Revenue OS v3"
  });
});

/* =========================
   LEAD API (CORE ENGINE)
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

    /* =========================
       VALIDATION
    ========================= */

    if (!contact || contact.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "Invalid contact information"
      });
    }

    const cleanContact = contact.trim();

    /* =========================
       DUPLICATE CHECK
    ========================= */

    const { data: existing, error: fetchError } = await supabase
      .from("leads")
      .select("id")
      .eq("contact", cleanContact)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({
        success: false,
        error: fetchError.message
      });
    }

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Lead already exists",
        leadId: existing.id
      });
    }

    /* =========================
       SCORE + CITY
    ========================= */

    const score = calculateLeadScore({
      service,
      postalCode,
      source
    });

    const city = detectCity(postalCode);

    /* =========================
       CONTRACTOR MATCHING
    ========================= */

    const contractor = await getContractor(city);

    /* =========================
       CREATE LEAD
    ========================= */

    const leadId = uuidv4();

    const newLead = {
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
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(newLead)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    /* =========================
       ALERT OWNER (SMS)
    ========================= */

    if (score >= 10) {
      await smsClient.messages.create({
        body: `🔥 HOT LEAD
${name} | ${cleanContact}
City: ${city}
Service: ${service}
Score: ${score}`,
        from: process.env.TWILIO_NUMBER,
        to: process.env.MY_PHONE
      });
    }

    /* =========================
       ASSIGN + SELL LEAD TO CONTRACTOR
    ========================= */

    if (contractor) {
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

      /* SEND CONTRACTOR SMS */
      await smsClient.messages.create({
        body: `📍 NEW LEAD - ${city}
${name} | ${cleanContact}
Service: ${service}
Price: $${contractor.price_per_lead}
Score: ${score}`,
        from: process.env.TWILIO_NUMBER,
        to: contractor.phone
      });
    }

    /* =========================
       EMAIL ALERT (3CX FLOW)
    ========================= */

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
      `
    });

    /* =========================
       RESPONSE
    ========================= */

    return res.status(201).json({
      success: true,
      leadId,
      score,
      city,
      assigned: !!contractor,
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
  console.log(`🚀 NorthSky Revenue OS running on port ${PORT}`);
});