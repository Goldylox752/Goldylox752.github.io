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
   EMAIL (3CX ALERT)
========================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* =========================
   TWILIO SMS (3CX / ALERT LAYER)
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

  if (source === "ad