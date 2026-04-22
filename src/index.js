// src/index.js

// Load .env only in non-production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- REQUIRED ENV VALIDATION ----------
const requiredEnv = [
  'STRIPE_SECRET_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY'
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing env variable: ${key}`);
    process.exit(1);
  }
});

// ---------- Middleware ----------
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(xssClean());
app.use(hpp());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ---------- Health ----------
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

// ---------- Validation ----------
app.post(
  '/api/validate',
  [
    body('email').isEmail().normalizeEmail(),
    body('age').optional().isInt({ min: 18 }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    res.json({ success: true, data: req.body });
  }
);

// ---------- Twilio (lazy init) ----------
app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Missing to/message' });
    }

    if (!process.env.TWILIO_ACCOUNT_SID) {
      return res.status(500).json({ error: 'Twilio not configured' });
    }

    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    res.json({ success: true, sid: result.sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Stripe (lazy init) ----------
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Supabase ----------
app.get('/api/supabase-test', async (req, res) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (error) throw error;

    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- UUID ----------
app.get('/api/uuid', (req, res) => {
  res.json({ id: uuidv4() });
});

// ---------- 404 ----------
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ---------- Error Handler ----------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error' });
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});