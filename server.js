const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store (replace with DB in production)
const validSessions = new Map(); // session_id -> { plan, userId }

// 1. Create Stripe Checkout session
app.post('/api/create-checkout', async (req, res) => {
  const { plan, successUrl, cancelUrl, userId } = req.body;
  const priceId = process.env[`STRIPE_${plan.toUpperCase()}_PRICE_ID`];
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, plan }
    });
    validSessions.set(session.id, { plan, userId, valid: false });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Verify subscription (called by frontend after redirect)
app.post('/api/verify', async (req, res) => {
  const { session_id } = req.body;
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1] || session_id;
  
  try {
    const session = await stripe.checkout.sessions.retrieve(token);
    const isValid = session.payment_status === 'paid' || session.status === 'complete';
    if (isValid) {
      validSessions.set(token, { plan: session.metadata.plan, valid: true });
      return res.json({ valid: true, plan: session.metadata.plan });
    }
    res.json({ valid: false });
  } catch {
    res.json({ valid: false });
  }
});

// 3. Event tracking (optional)
app.post('/api/event', (req, res) => {
  console.log('Event:', req.body);
  res.json({ ok: true });
});

// 4. Offer signup storage
app.post('/api/offer-signup', (req, res) => {
  console.log('Offer signup:', req.body);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const twilio = require("twilio");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

dotenv.config();
const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Raw body for Stripe webhook (must be before JSON parser)
app.post("/webhook/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      await supabase.from("verified_sessions").insert([{
        session_id: session.id,
        customer_email: session.customer_details.email,
        plan: session.metadata?.plan || "starter",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString()
      }]);
      console.log(`✅ Subscription verified for ${session.customer_details.email}`);
      break;
      
    case "customer.subscription.deleted":
      console.log("Subscription cancelled:", event.data.object.id);
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
  
  res.json({ received: true });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   ENV CHECK (STRICT)
========================= */
const required = ["SUPABASE_URL", "SUPABASE_KEY", "STRIPE_SECRET"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`❌ Missing ${k} in environment variables`);
    process.exit(1);
  }
}

/* =========================
   RATE LIMIT
========================= */
const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, error: "Too many requests, try later" }
});

/* =========================
   SERVICES
========================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const stripe = new Stripe(process.env.STRIPE_SECRET);

let sms = null;
if (process.env.TWILIO_SID && process.env.TWILIO_AUTH && process.env.TWILIO_NUMBER) {
  sms = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
}

/* =========================
   STRIPE CHECKOUT ENDPOINTS
========================= */

const PLAN_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
  elite: process.env.STRIPE_ELITE_PRICE_ID
};

// Create checkout session
app.post("/api/create-checkout", async (req, res) => {
  try {
    const { plan, successUrl, cancelUrl, userId } = req.body;
    
    // Map plan to Stripe Payment Links
    let paymentLink;
    switch(plan) {
      case "starter":
        paymentLink = "https://buy.stripe.com/aFaeV6cX97yIfsjcvu2ZO0E";
        break;
      case "pro":
        paymentLink = "https://buy.stripe.com/dRm28k8GTaKU1Btcvu2ZO0D";
        break;
      case "elite":
        paymentLink = "https://buy.stripe.com/dRmfZae1d2eoeofgLK2ZO0C";
        break;
      default:
        return res.status(400).json({ error: "Invalid plan" });
    }
    
    // Use full Stripe Checkout if Price IDs are configured
    if (PLAN_PRICE_IDS[plan] && process.env.STRIPE_SECRET) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price: PLAN_PRICE_IDS[plan],
          quantity: 1,
        }],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          plan: plan,
          userId: userId || "anonymous"
        }
      });
      return res.json({ url: session.url });
    }
    
    // Fallback to direct payment link redirect
    return res.json({ url: paymentLink });
    
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Verify subscription status
app.post("/api/verify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({ valid: false });
    }
    
    const token = authHeader.split(" ")[1];
    
    const { data, error } = await supabase
      .from("verified_sessions")
      .select("*")
      .eq("session_id", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    
    if (data && !error) {
      return res.json({ valid: true, plan: data.plan });
    }
    
    return res.json({ valid: false });
  } catch (err) {
    console.error("Verify error:", err);
    res.json({ valid: false });
  }
});

// Offer signup endpoint
app.post("/api/offer-signup", async (req, res) => {
  try {
    const { email, name, userId } = req.body;
    
    const { error } = await supabase
      .from("offer_signups")
      .insert([{
        email,
        name: name || null,
        user_id: userId,
        created_at: new Date().toISOString()
      }]);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Offer signup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================
   HELPERS
========================= */
function cleanContact(contact) {
  return contact.trim().toLowerCase();
}

function scoreLead({ service, source, postalCode }) {
  let score = 0;
  const svc = (service || "").toLowerCase();
  if (svc.includes("inspection")) score += 5;
  if (svc.includes("repair")) score += 7;
  if (svc.includes("replacement")) score += 10;
  if (source === "ad") score += 5;
  if (postalCode && postalCode.toUpperCase().startsWith("T")) score += 3;
  return score;
}

function getCity(postal) {
  if (!postal) return "unknown";
  const p = postal.toUpperCase();
  if (p.startsWith("T5")) return "Edmonton";
  if (p.startsWith("T2")) return "Calgary";
  return "Alberta";
}

async function getBestBuyer(city) {
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

async function chargeContractor(buyer, amount, leadId) {
  if (!buyer.stripe_customer_id || !buyer.default_payment_method) {
    throw new Error("Contractor missing payment method");
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: "cad",
    customer: buyer.stripe_customer_id,
    payment_method: buyer.default_payment_method,
    off_session: true,
    confirm: true,
    metadata: {
      lead_id: leadId,
      contractor_id: buyer.id,
      environment: process.env.NODE_ENV || "production"
    },
    idempotency_key: `lead_${leadId}`
  });

  return paymentIntent;
}

/* =========================
   POST /lead - Submit a lead
========================= */
app.post("/lead", leadLimiter, async (req, res) => {
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
      return res.status(400).json({ success: false, error: "Invalid contact" });
    }

    const clean = cleanContact(contact);

    const { data: existing, error: dupError } = await supabase
      .from("leads")
      .select("id")
      .eq("contact", clean)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (dupError) console.error("Duplicate check error:", dupError);

    if (existing) {
      return res.json({ success: true, leadId: existing.id, alreadyExists: true });
    }

    const score = scoreLead({ service, source, postalCode });
    const city = getCity(postalCode);
    const leadId = uuidv4();

    const buyer = await getBestBuyer(city);
    let revenue = 0;
    let charged = false;

    if (buyer) {
      revenue = buyer.price_per_lead;
      try {
        await chargeContractor(buyer, revenue, leadId);
        charged = true;
      } catch (chargeErr) {
        console.error(`❌ Payment failed for contractor ${buyer.id}:`, chargeErr.message);
        await supabase
          .from("contractors")
          .update({ active: false, last_error: chargeErr.message })
          .eq("id", buyer.id);
      }
    }

    const { error: leadError } = await supabase.from("leads").insert([{
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
      status: charged ? "sold" : "new",
      created_at: new Date().toISOString()
    }]);

    if (leadError) throw new Error(`Lead insert failed: ${leadError.message}`);

    if (buyer && charged) {
      const { error: assignError } = await supabase.from("lead_assignments").insert([{
        id: uuidv4(),
        lead_id: leadId,
        contractor_id: buyer.id,
        price: revenue,
        city,
        status: "paid",
        assigned_at: new Date().toISOString()
      }]);

      if (assignError) console.error("Assignment insert error:", assignError);

      if (sms && buyer.phone) {
        try {
          await sms.messages.create({
            body: `🔥 PAID LEAD\n${service} | ${city}\nContact: ${contact}\nAmount: $${revenue}\nLead ID: ${leadId}`,
            from: process.env.TWILIO_NUMBER,
            to: buyer.phone
          });
        } catch (smsErr) {
          console.error("SMS notification failed:", smsErr.message);
        }
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
    console.error("Lead endpoint error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* =========================
   POST /api/event - Track user behavior & score
========================= */
const eventScoreMap = {
  page_view: 1,
  click: 2,
  funnel_click: 5,
  checkout_click: 10,
  lead: 8
};

app.post("/api/event", async (req, res) => {
  try {
    const event = req.body;
    const { user_id, event: eventType, session_id, metadata } = event;

    if (!user_id || !eventType) {
      return res.status(400).json({ success: false, error: "user_id and event are required" });
    }

    const scoreValue = eventScoreMap[eventType] || 0;

    let currentScore = 0;
    const { data: userScoreData, error: fetchError } = await supabase
      .from("user_scores")
      .select("total_score")
      .eq("user_id", user_id)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching user score:", fetchError);
    }

    if (userScoreData) {
      currentScore = userScoreData.total_score;
    }

    const newTotalScore = currentScore + scoreValue;

    let stage = "COLD";
    if (newTotalScore >= 15) stage = "HOT";
    else if (newTotalScore >= 6) stage = "WARM";

    const enrichedEvent = {
      id: uuidv4(),
      user_id,
      event: eventType,
      session_id: session_id || null,
      metadata: metadata || {},
      score_delta: scoreValue,
      cumulative_score: newTotalScore,
      stage,
      created_at: new Date().toISOString()
    };

    const { error: insertEventError } = await supabase
      .from("events")
      .insert([enrichedEvent]);

    if (insertEventError) throw new Error(`Event insert failed: ${insertEventError.message}`);

    const { error: upsertError } = await supabase
      .from("user_scores")
      .upsert({
        user_id,
        total_score: newTotalScore,
        last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (upsertError) console.error("User score upsert error:", upsertError);

    if (stage === "HOT") {
      const { error: hotLeadError } = await supabase
        .from("hot_leads")
        .insert([{
          id: uuidv4(),
          user_id,
          score: newTotalScore,
          source_event_id: enrichedEvent.id,
          created_at: new Date().toISOString(),
          processed: false
        }]);

      if (hotLeadError) {
        console.error("Hot lead insert error:", hotLeadError);
      } else {
        console.log(`🔥 HOT LEAD for user ${user_id} (score ${newTotalScore})`);
      }
    }

    if (eventType === "checkout_click") {
      const { error: checkoutError } = await supabase
        .from("checkout_events")
        .insert([{ ...enrichedEvent, original_metadata: metadata }]);

      if (checkoutError) console.error("Checkout event insert error:", checkoutError);
    }

    res.json({ success: true, stage, score: scoreValue, cumulativeScore: newTotalScore });

  } catch (err) {
    console.error("Event tracking error:", err);
    res.status(500).json({ success: false, error: "Failed to process event" });
  }
});

/* =========================
   POST /contractor/signup - Register a contractor
========================= */
app.post("/contractor/signup", async (req, res) => {
  try {
    const { name, email, phone, city } = req.body;
    if (!name || !email || !city) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const customer = await stripe.customers.create({
      email,
      name,
      phone: phone || null
    });

    const { data, error } = await supabase
      .from("contractors")
      .insert([{
        id: uuidv4(),
        name,
        email,
        phone: phone || null,
        city,
        stripe_customer_id: customer.id,
        active: true,
        price_per_lead: 50,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, contractorId: data.id });

  } catch (err) {
    console.error("Contractor signup error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`💰 NorthSky Lead Engine running on http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📦 SMS enabled: ${sms ? "yes" : "no"}`);
});
