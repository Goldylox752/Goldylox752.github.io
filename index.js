const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");
const hpp = require("hpp");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const twilio = require("twilio");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

dotenv.config();
const app = express();

/* =========================
   SECURITY MIDDLEWARE (early)
========================= */
app.use(helmet());                               // Secure HTTP headers
app.use(xss());                                  // Sanitize user input
app.use(hpp());                                  // Prevent HTTP param pollution

// Strict CORS – allow only your frontend domain
const corsOptions = {
  origin: process.env.FRONTEND_URL || "https://yourdomain.com", // set in .env
  optionsSuccessStatus: 200,
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type", "x-api-key"]
};
app.use(cors(corsOptions));

// Limit JSON body size to 10KB (prevents large payload attacks)
app.use(express.json({ limit: "10kb" }));

// Serve static files (HTML, JS, CSS, etc.) from /public
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   ENVIRONMENT CHECKS
========================= */
const required = ["SUPABASE_URL", "SUPABASE_KEY", "STRIPE_SECRET"];
required.forEach(k => {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
});

// Optional but recommended for security
const API_KEY = process.env.API_KEY; // used to protect contractor signup
if (!API_KEY) console.warn("⚠️ API_KEY not set – contractor signup endpoint is unprotected");

/* =========================
   RATE LIMITING (global + per route)
========================= */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP"
});
app.use(globalLimiter);

// Stricter limit for lead submission
const leadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // max 10 leads per minute per IP
  message: "Too many lead submissions, please slow down"
});

/* =========================
   SERVICES
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: "2025-02-24.acacia" // use latest stable
});

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
   💳 CHARGE CONTRACTOR (with idempotency)
========================= */
async function chargeContractor(buyer, amount, leadId, idempotencyKey) {
  if (!buyer.stripe_customer_id || !buyer.default_payment_method) {
    throw new Error("No payment method");
  }

  const payment = await stripe.paymentIntents.create(
    {
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
    },
    { idempotencyKey }
  );

  return payment;
}

/* =========================
   AUTHENTICATION MIDDLEWARE (for contractor routes)
========================= */
function authenticateApiKey(req, res, next) {
  const providedKey = req.headers["x-api-key"];
  if (!API_KEY || providedKey !== API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

/* =========================
   VALIDATION RULES
========================= */
const leadValidationRules = [
  body("contact")
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage("Contact must be between 5 and 100 characters")
    .matches(/^[^<>{}]+$/) // basic XSS prevention (no HTML/script tags)
    .withMessage("Invalid characters in contact"),
  body("name").optional().trim().escape().isLength({ max: 100 }),
  body("postalCode")
    .optional()
    .matches(/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/)
    .withMessage("Invalid Canadian postal code"),
  body("service").optional().trim().escape(),
  body("source").optional().trim().escape(),
  body("siteId").optional().trim().escape(),
  body("pageUrl").optional().isURL().withMessage("Invalid URL")
];

const contractorValidationRules = [
  body("name").trim().notEmpty().escape().isLength({ max: 100 }),
  body("email").isEmail().normalizeEmail(),
  body("phone").matches(/^\+?[1-9]\d{1,14}$/).withMessage("Invalid phone number (E.164 format)"),
  body("city").trim().notEmpty().escape().isLength({ max: 50 })
];

/* =========================
   LEAD ENDPOINT (SECURED)
========================= */
app.post("/lead", leadLimiter, leadValidationRules, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

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

    const clean = cleanContact(contact);

    // Duplicate check
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("contact", clean)
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, leadId: existing.id });
    }

    const score = scoreLead({ service, source, postalCode });
    const city = getCity(postalCode);
    const leadId = uuidv4();

    // Find buyer
    const buyer = await getBuyer(city);

    let revenue = 0;
    let charged = false;

    // Insert lead as "pending" to avoid race condition
    if (buyer) {
      revenue = buyer.price_per_lead;

      // Create pending lead record
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
        status: "pending_payment",  // temporary status
        created_at: new Date().toISOString()
      }]);

      // Charge contractor with idempotency key
      const idempotencyKey = `${leadId}_${Date.now()}`;
      try {
        await chargeContractor(buyer, revenue, leadId, idempotencyKey);
        charged = true;
      } catch (err) {
        console.error("❌ PAYMENT FAILED:", err.message);
        // Update lead status to "payment_failed"
        await supabase
          .from("leads")
          .update({ status: "payment_failed" })
          .eq("id", leadId);
        // Disable contractor
        await supabase
          .from("contractors")
          .update({ active: false })
          .eq("id", buyer.id);
        return res.status(402).json({ success: false, error: "Payment failed" });
      }

      // Payment succeeded – update lead status to sold
      await supabase
        .from("leads")
        .update({ status: "sold" })
        .eq("id", leadId);

      // Create assignment record
      await supabase.from("lead_assignments").insert([{
        id: uuidv4(),
        lead_id: leadId,
        contractor_id: buyer.id,
        price: revenue,
        city,
        status: "paid"
      }]);

      // Send SMS notification if configured
      if (sms && buyer.phone) {
        await sms.messages.create({
          body: `🔥 PAID LEAD\n${service} | ${city}\n${contact}\n$${revenue}`,
          from: process.env.TWILIO_NUMBER,
          to: buyer.phone
        });
      }

    } else {
      // No buyer – save lead as "new"
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
        status: "new",
        created_at: new Date().toISOString()
      }]);
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
    console.error("Lead error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* =========================
   CONTRACTOR SIGNUP (PROTECTED WITH API KEY)
========================= */
app.post("/contractor/signup", authenticateApiKey, contractorValidationRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, phone, city } = req.body;

    const customer = await stripe.customers.create({
      email,
      name,
      phone
    });

    const { data, error } = await supabase
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

    if (error) throw error;

    res.json({ success: true, contractorId: data.id });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, error: "Could not create contractor" });
  }
});

/* =========================
   HEALTH CHECK (optional)
========================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`💰 NorthSky Lead Engine LIVE on http://localhost:${PORT}`);
});