const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const xss = require("xss-clean");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const twilio = require("twilio");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");

const app = express();

// =========================
//  SECURITY MIDDLEWARE (except raw body for webhook)
// =========================
app.use(helmet({
  contentSecurityPolicy: false, // disable for API routes
}));
app.use(xss());
app.use(hpp());

// CORS – allow frontend origins
const allowedOrigins = (process.env.FRONTEND_URLS || "http://localhost:3000,https://yourdomain.vercel.app").split(",");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// Regular JSON parser (not for webhook)
app.use(express.json({ limit: "10kb" }));

// =========================
//  ENVIRONMENT CHECKS
// =========================
const requiredEnv = ["SUPABASE_URL", "SUPABASE_KEY", "STRIPE_SECRET", "STRIPE_WEBHOOK_SECRET"];
requiredEnv.forEach(key => {
  if (!process.env[key]) console.error(`❌ Missing ${key}`);
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  auth: { persistSession: false },
});

const stripe = new Stripe(process.env.STRIPE_SECRET, {
  apiVersion: "2025-02-24.acacia",
  maxNetworkRetries: 2,
});

const twilioClient = process.env.TWILIO_SID && process.env.TWILIO_AUTH && process.env.TWILIO_NUMBER
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH)
  : null;

const API_KEY = process.env.API_KEY;

// =========================
//  HELPERS
// =========================
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
  if (error) return null;
  return data;
}

async function chargeContractor(buyer, amount, leadId, idempotencyKey) {
  if (!buyer.stripe_customer_id || !buyer.default_payment_method) {
    throw new Error("Contractor has no payment method");
  }
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "cad",
    customer: buyer.stripe_customer_id,
    payment_method: buyer.default_payment_method,
    off_session: true,
    confirm: true,
    metadata: { lead_id: leadId, contractor_id: buyer.id, lead_price: amount.toString() },
  }, { idempotencyKey });
}

// =========================
//  API ROUTES
// =========================

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Create Stripe Checkout session (used by frontend)
app.post("/api/create-checkout", async (req, res) => {
  try {
    const { plan, successUrl, cancelUrl } = req.body;
    if (!plan || !["starter", "pro", "elite"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const plans = {
      starter: { price: 9900, name: "NorthSky Starter Plan" },
      pro: { price: 29900, name: "NorthSky Pro Plan" },
      elite: { price: 99900, name: "NorthSky Elite Plan" },
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "cad",
          product_data: { name: plans[plan].name, metadata: { plan_type: plan } },
          unit_amount: plans[plan].price,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      mode: "subscription",
      success_url: successUrl || `${FRONTEND_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || FRONTEND_URL,
      metadata: { plan, platform: "northsky_os" },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Verify subscription token (used by frontend)
app.get("/api/verify", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) return res.json({ valid: false });

  try {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status, plan")
      .eq("id", token)
      .maybeSingle();
    if (error) throw error;
    const valid = data && data.status === "active";
    res.json({ valid, plan: data?.plan || null });
  } catch (err) {
    console.error("Verify error:", err);
    res.json({ valid: false });
  }
});

// Stripe Webhook (requires raw body)
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;
      const plan = session.metadata?.plan;
      if (customerEmail && plan) {
        await supabase.from("subscriptions").insert({
          id: session.id,
          email: customerEmail,
          plan: plan,
          status: "active",
          stripe_customer_id: session.customer,
          created_at: new Date().toISOString(),
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await supabase.from("subscriptions").update({ status: "canceled" }).eq("id", subscription.id);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Webhook failed" });
  }
});

// Lead submission (protected? optional API key)
app.post("/lead", async (req, res) => {
  // Basic validation inline; you can add express-validator if desired
  const { name, contact, postalCode, service, source, siteId, pageUrl } = req.body;
  if (!contact || contact.length < 5) {
    return res.status(400).json({ success: false, error: "Valid contact required" });
  }
  try {
    const clean = cleanContact(contact);
    // Duplicate check
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("contact", clean)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString())
      .maybeSingle();
    if (existing) return res.json({ success: true, leadId: existing.id, duplicate: true });

    const leadId = uuidv4();
    const score = scoreLead({ service, source, postalCode });
    const city = getCity(postalCode);
    const buyer = await getBuyer(city);
    let revenue = 0, charged = false;

    if (buyer) {
      revenue = buyer.price_per_lead;
      await supabase.from("leads").insert({
        id: leadId, name, contact: clean, postal_code: postalCode,
        service, source, site_id: siteId, page_url: pageUrl,
        score, city, status: "pending_payment", created_at: new Date().toISOString(),
      });
      try {
        await chargeContractor(buyer, revenue, leadId, `${leadId}_${Date.now()}`);
        charged = true;
        await supabase.from("leads").update({ status: "sold" }).eq("id", leadId);
        await supabase.from("lead_assignments").insert({
          id: uuidv4(), lead_id: leadId, contractor_id: buyer.id, price: revenue,
          city, status: "paid", assigned_at: new Date().toISOString(),
        });
        if (twilioClient && buyer.phone) {
          await twilioClient.messages.create({
            body: `🔥 PAID LEAD\nService: ${service}\nCity: ${city}\nContact: ${contact}\nPrice: $${revenue} CAD`,
            from: process.env.TWILIO_NUMBER,
            to: buyer.phone,
          });
        }
      } catch (err) {
        await supabase.from("leads").update({ status: "payment_failed" }).eq("id", leadId);
        await supabase.from("contractors").update({ active: false }).eq("id", buyer.id);
        return res.status(402).json({ success: false, error: "Payment failed" });
      }
    } else {
      await supabase.from("leads").insert({
        id: leadId, name, contact: clean, postal_code: postalCode,
        service, source, site_id: siteId, page_url: pageUrl,
        score, city, status: "new", created_at: new Date().toISOString(),
      });
    }
    res.json({ success: true, leadId, score, city, revenue, charged });
  } catch (err) {
    console.error("Lead error:", err);
    res.status(500).json({ success: false, error: "Internal error" });
  }
});

// Contractor signup (with optional API key protection)
app.post("/contractor/signup", async (req, res) => {
  const providedKey = req.headers["x-api-key"];
  if (API_KEY && providedKey !== API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { name, email, phone, city } = req.body;
  if (!name || !email || !phone || !city) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }
  try {
    const { data: existing } = await supabase.from("contractors").select("id").eq("email", email).maybeSingle();
    if (existing) return res.status(409).json({ success: false, error: "Contractor exists" });

    const customer = await stripe.customers.create({ email, name, phone, metadata: { source: "northsky" } });
    const { data, error } = await supabase.from("contractors").insert({
      id: uuidv4(), name, email, phone, city,
      stripe_customer_id: customer.id, active: true, price_per_lead: 50,
      created_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    res.json({ success: true, contractorId: data.id });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add payment method for contractor
app.post("/contractor/payment-method", async (req, res) => {
  const providedKey = req.headers["x-api-key"];
  if (API_KEY && providedKey !== API_KEY) {
    return res.status(401).json({ success: false });
  }
  const { contractorId, paymentMethodId } = req.body;
  if (!contractorId || !paymentMethodId) {
    return res.status(400).json({ success: false, error: "Missing ids" });
  }
  try {
    const { data: contractor } = await supabase.from("contractors").select("stripe_customer_id").eq("id", contractorId).single();
    if (!contractor) return res.status(404).json({ success: false });
    await stripe.paymentMethods.attach(paymentMethodId, { customer: contractor.stripe_customer_id });
    await stripe.customers.update(contractor.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    await supabase.from("contractors").update({ default_payment_method: paymentMethodId }).eq("id", contractorId);
    res.json({ success: true });
  } catch (err) {
    console.error("Payment method error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Catch-all for any other routes – serve frontend if you want, but Vercel can serve static files separately
app.get("*", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

// =========================
//  EXPORT FOR VERCEL
// =========================
module.exports = app;