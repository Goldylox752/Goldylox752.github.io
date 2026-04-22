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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://*.vercel.app"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://*.supabase.co"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.stripe.com"],
    },
  },
}));
app.use(xss());
app.use(hpp());

// Dynamic CORS – allow multiple frontend origins
const allowedOrigins = (process.env.FRONTEND_URLS || "http://localhost:3000,https://yourdomain.com").split(",");
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionsSuccessStatus: 200,
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Limit JSON body size to 10KB
app.use(express.json({ limit: "10kb" }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   ENVIRONMENT CHECKS
========================= */
const required = ["SUPABASE_URL", "SUPABASE_KEY", "STRIPE_SECRET", "STRIPE_WEBHOOK_SECRET"];
required.forEach(k => {
  if (!process.env[k]) {
    console.error(`❌ Missing ${k} in environment variables`);
    process.exit(1);
  }
});

const API_KEY = process.env.API_KEY;
if (!API_KEY) console.warn("⚠️ API_KEY not set – contractor endpoints are unprotected");

/* =========================
   RATE LIMITING
========================= */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: "Too many requests from this IP",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many lead submissions, please slow down",
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many checkout attempts, please wait",
});

/* =========================
   SERVICES
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: { persistSession: false },
    db: { schema: "public" },
  }
);

const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: "2025-02-24.acacia",
  maxNetworkRetries: 2,
});

const sms = process.env.TWILIO_SID && process.env.TWILIO_AUTH && process.env.TWILIO_NUMBER
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
  const serviceLower = (service || "").toLowerCase();
  if (serviceLower.includes("inspection")) score += 5;
  if (serviceLower.includes("repair")) score += 7;
  if (serviceLower.includes("replacement")) score += 10;
  if (source === "ad") score += 5;
  if (postalCode && postalCode.match(/^[A-Z]/i)) score += 3;
  return Math.min(score, 50);
}

function getCity(postal) {
  if (!postal) return "unknown";
  const upper = postal.toUpperCase().trim();
  if (upper.startsWith("T5")) return "Edmonton";
  if (upper.startsWith("T2") || upper.startsWith("T3")) return "Calgary";
  if (upper.startsWith("V")) return "Vancouver";
  if (upper.startsWith("M")) return "Toronto";
  return "Alberta";
}

async function getBuyer(city) {
  const { data, error } = await supabase
    .from("contractors")
    .select("*")
    .eq("city", city)
    .eq("active", true)
    .order("price_per_lead", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching buyer:", error.message);
    return null;
  }
  return data;
}

async function chargeContractor(buyer, amount, leadId, idempotencyKey) {
  if (!buyer.stripe_customer_id || !buyer.default_payment_method) {
    throw new Error("Contractor has no payment method on file");
  }

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: Math.round(amount * 100),
      currency: "cad",
      customer: buyer.stripe_customer_id,
      payment_method: buyer.default_payment_method,
      off_session: true,
      confirm: true,
      metadata: {
        lead_id: leadId,
        contractor_id: buyer.id,
        lead_price: amount.toString(),
      },
    },
    { idempotencyKey }
  );

  return paymentIntent;
}

/* =========================
   AUTHENTICATION MIDDLEWARE
========================= */
function authenticateApiKey(req, res, next) {
  const providedKey = req.headers["x-api-key"];
  if (!API_KEY || providedKey !== API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized: Invalid or missing API key" });
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
    .matches(/^[^<>{}()[\]]+$/)
    .withMessage("Invalid characters in contact"),
  body("name").optional().trim().escape().isLength({ max: 100 }),
  body("postalCode")
    .optional()
    .matches(/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/)
    .withMessage("Invalid Canadian postal code format"),
  body("service").optional().trim().escape().isLength({ max: 50 }),
  body("source").optional().trim().escape().isLength({ max: 50 }),
  body("siteId").optional().trim().escape().isLength({ max: 100 }),
  body("pageUrl").optional().isURL().withMessage("Invalid URL"),
];

const contractorValidationRules = [
  body("name").trim().notEmpty().escape().isLength({ max: 100 }),
  body("email").isEmail().normalizeEmail(),
  body("phone").matches(/^\+?[1-9]\d{1,14}$/).withMessage("Invalid phone number (E.164 format)"),
  body("city").trim().notEmpty().escape().isLength({ max: 50 }),
];

const paymentMethodValidationRules = [
  body("contractorId").isUUID().withMessage("Valid contractor ID required"),
  body("paymentMethodId").notEmpty().withMessage("Payment method ID required"),
];

/* =========================
   STRIPE CHECKOUT SESSION (for frontend purchases)
========================= */
app.post("/api/create-checkout", checkoutLimiter, async (req, res) => {
  try {
    const { plan, successUrl, cancelUrl } = req.body;

    if (!plan || !["starter", "pro", "elite"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    const planPrices = {
      starter: 9900,  // $99.00 CAD
      pro: 29900,     // $299.00 CAD
      elite: 99900,   // $999.00 CAD
    };

    const planNames = {
      starter: "NorthSky Starter Plan",
      pro: "NorthSky Pro Plan",
      elite: "NorthSky Elite Plan",
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: planNames[plan],
              description: `Monthly subscription - ${plan} access to Revenue Hub`,
              metadata: { plan_type: plan },
            },
            unit_amount: planPrices[plan],
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl || `${process.env.FRONTEND_URL || "http://localhost:3000"}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || "http://localhost:3000"}?checkout=cancel`,
      metadata: { plan, platform: "northsky_os" },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/* =========================
   STRIPE WEBHOOK (handle subscription events)
========================= */
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerEmail = session.customer_details?.email;
        const plan = session.metadata?.plan;

        if (customerEmail && plan) {
          // Store subscription in Supabase for verification
          const { error } = await supabase.from("subscriptions").insert({
            id: session.id,
            email: customerEmail,
            plan: plan,
            status: "active",
            stripe_customer_id: session.customer,
            created_at: new Date().toISOString(),
          });
          if (error) console.error("Failed to save subscription:", error.message);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("id", subscription.id);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

/* =========================
   VERIFY USER AUTHENTICATION
========================= */
app.get("/api/verify", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token) {
    return res.json({ valid: false, message: "No token provided" });
  }

  try {
    // Check if token corresponds to a valid subscription
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, plan")
      .eq("id", token)
      .maybeSingle();

    if (error) throw error;

    const isValid = data && data.status === "active";
    res.json({ valid: isValid, plan: data?.plan || null });
  } catch (err) {
    console.error("Verification error:", err);
    res.json({ valid: false, message: "Verification failed" });
  }
});

/* =========================
   ADD PAYMENT METHOD FOR CONTRACTOR
========================= */
app.post("/contractor/payment-method", authenticateApiKey, paymentMethodValidationRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { contractorId, paymentMethodId } = req.body;

    const { data: contractor, error: fetchError } = await supabase
      .from("contractors")
      .select("stripe_customer_id")
      .eq("id", contractorId)
      .single();

    if (fetchError || !contractor) {
      return res.status(404).json({ success: false, error: "Contractor not found" });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: contractor.stripe_customer_id,
    });

    // Set as default payment method
    await stripe.customers.update(contractor.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Update contractor record
    await supabase
      .from("contractors")
      .update({ default_payment_method: paymentMethodId })
      .eq("id", contractorId);

    res.json({ success: true, message: "Payment method added successfully" });
  } catch (err) {
    console.error("Payment method error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================
   LEAD ENDPOINT (SECURED)
========================= */
app.post("/lead", leadLimiter, leadValidationRules, async (req, res) => {
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
      pageUrl = null,
    } = req.body;

    const clean = cleanContact(contact);

    // Duplicate check within last 24 hours
    const { data: existing } = await supabase
      .from("leads")
      .select("id, created_at")
      .eq("contact", clean)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .maybeSingle();

    if (existing) {
      return res.json({ success: true, leadId: existing.id, duplicate: true });
    }

    const score = scoreLead({ service, source, postalCode });
    const city = getCity(postalCode);
    const leadId = uuidv4();

    const buyer = await getBuyer(city);
    let revenue = 0;
    let charged = false;

    if (buyer) {
      revenue = buyer.price_per_lead;

      await supabase.from("leads").insert([{
        id: leadId,
        name: name || null,
        contact: clean,
        postal_code: postalCode || null,
        service,
        source,
        site_id: siteId,
        page_url: pageUrl,
        score,
        city,
        status: "pending_payment",
        created_at: new Date().toISOString(),
      }]);

      const idempotencyKey = `${leadId}_${Date.now()}`;
      try {
        await chargeContractor(buyer, revenue, leadId, idempotencyKey);
        charged = true;

        await supabase
          .from("leads")
          .update({ status: "sold" })
          .eq("id", leadId);

        await supabase.from("lead_assignments").insert([{
          id: uuidv4(),
          lead_id: leadId,
          contractor_id: buyer.id,
          price: revenue,
          city,
          status: "paid",
          assigned_at: new Date().toISOString(),
        }]);

        if (sms && buyer.phone) {
          await sms.messages.create({
            body: `🔥 PAID LEAD\nService: ${service}\nCity: ${city}\nContact: ${contact}\nPrice: $${revenue} CAD`,
            from: process.env.TWILIO_NUMBER,
            to: buyer.phone,
          }).catch(e => console.error("SMS failed:", e.message));
        }
      } catch (err) {
        console.error("Payment failed:", err.message);
        await supabase
          .from("leads")
          .update({ status: "payment_failed" })
          .eq("id", leadId);

        await supabase
          .from("contractors")
          .update({ active: false })
          .eq("id", buyer.id);

        return res.status(402).json({ success: false, error: "Payment failed. Contractor has been deactivated." });
      }
    } else {
      await supabase.from("leads").insert([{
        id: leadId,
        name: name || null,
        contact: clean,
        postal_code: postalCode || null,
        service,
        source,
        site_id: siteId,
        page_url: pageUrl,
        score,
        city,
        status: "new",
        created_at: new Date().toISOString(),
      }]);
    }

    res.json({
      success: true,
      leadId,
      score,
      city,
      revenue,
      charged,
    });
  } catch (err) {
    console.error("Lead processing error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* =========================
   CONTRACTOR SIGNUP (PROTECTED)
========================= */
app.post("/contractor/signup", authenticateApiKey, contractorValidationRules, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, phone, city } = req.body;

    const existingContractor = await supabase
      .from("contractors")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingContractor.data) {
      return res.status(409).json({ success: false, error: "Contractor already exists with this email" });
    }

    const customer = await stripe.customers.create({
      email,
      name,
      phone,
      metadata: { source: "northsky_lead_system" },
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
        price_per_lead: 50,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, contractorId: data.id, message: "Contractor registered successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, error: err.message || "Could not create contractor" });
  }
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || "development" });
});

/* =========================
   ERROR HANDLING MIDDLEWARE
========================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ success: false, error: "Something went wrong on the server" });
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`💰 NorthSky Lead Engine LIVE on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`💳 Stripe mode: ${process.env.STRIPE_SECRET?.startsWith("sk_test") ? "TEST" : "LIVE"}`);
});
