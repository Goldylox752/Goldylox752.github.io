import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());
app.use(express.json());

/* =========================
   RATE LIMIT (ANTI-SPAM)
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
   SUPABASE CLIENT
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   EMAIL (3CX ALERT BRIDGE)
========================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    system: "NorthSky Lead Engine v1"
  });
});

/* =========================
   LEAD API
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
      console.error("Duplicate check error:", fetchError);

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
      score: 0,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(newLead)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
        details: error
      });
    }

    /* =========================
       3CX / EMAIL ALERT HOOK
    ========================= */

    try {
      await transporter.sendMail({
        from: "NorthSky Leads <your@email.com>",
        to: process.env.ALERT_EMAIL,
        subject: "🚨 NEW ROOFING LEAD",
        text: `
Lead ID: ${leadId}
Name: ${name}
Contact: ${cleanContact}
Postal: ${postalCode}
Service: ${service}
Source: ${source}
Page: ${pageUrl}
        `
      });
    } catch (emailErr) {
      console.error("Email alert failed:", emailErr);
    }

    /* =========================
       RESPONSE
    ========================= */

    return res.status(201).json({
      success: true,
      leadId,
      message: "Lead captured successfully"
    });

  } catch (err) {
    console.error("Lead API crash:", err);

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
  console.log(`🚀 NorthSky Lead Engine running on port ${PORT}`);
});