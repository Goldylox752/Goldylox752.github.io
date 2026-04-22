// src/index.js
require('dotenv').config(); // optional: add dotenv if you want .env support (not in package.json but recommended)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const twilio = require('twilio');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Security & Utility Middlewares ----------
app.use(helmet()); // Sets various HTTP headers for security
app.use(cors());   // Enable CORS for all routes
app.use(express.json({ limit: '10kb' })); // Parse JSON bodies
app.use(xssClean()); // Sanitize user input against XSS
app.use(hpp());      // Prevent HTTP Parameter Pollution

// Global rate limiter (all endpoints)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// ---------- Health Check ----------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ---------- Example Validation Route ----------
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
    res.json({ message: 'Validation passed', data: req.body });
  }
);

// ---------- Twilio Example (SMS) ----------
// Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in env
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.post('/api/send-sms', async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing "to" or "message"' });
    }
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });
    res.json({ success: true, sid: result.sid });
  } catch (error) {
    console.error('Twilio error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Stripe Example (Create Payment Intent) ----------
// Needs STRIPE_SECRET_KEY in env
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd' } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency,
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Supabase Example ----------
// Needs SUPABASE_URL and SUPABASE_ANON_KEY in env
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.get('/api/supabase-test', async (req, res) => {
  try {
    // Example: fetch from a 'users' table (adjust to your actual table)
    const { data, error } = await supabase.from('users').select('*').limit(5);
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('Supabase error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- UUID Example ----------
app.get('/api/uuid', (req, res) => {
  res.json({ uuid: uuidv4() });
});

// ---------- 404 Handler ----------
app.use('*', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// ---------- Global Error Handler ----------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});