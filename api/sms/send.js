import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { to, body, userId } = req.body;

  if (!to || !body || !userId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // -----------------------------
  // 1. GET SUBSCRIPTION
  // -----------------------------
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (!sub) {
    return res.status(403).json({ error: "No active subscription" });
  }

  // -----------------------------
  // 2. CHECK CREDITS
  // -----------------------------
  if (sub.sms_credits <= 0) {
    return res.status(402).json({ error: "Out of SMS credits" });
  }

  // -----------------------------
  // 3. SEND SMS
  // -----------------------------
  try {
    const message = await client.messages.create({
      body,
      to,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    // -----------------------------
    // 4. DEDUCT CREDIT
    // -----------------------------
    await supabase
      .from("subscriptions")
      .update({
        sms_credits: sub.sms_credits - 1
      })
      .eq("user_id", userId);

    // -----------------------------
    // 5. LOG USAGE
    // -----------------------------
    await supabase.from("sms_logs").insert({
      user_id: userId,
      to_number: to,
      body,
      message_sid: message.sid,
      status: "sent",
      cost_credits: 1
    });

    return res.json({
      success: true,
      credits_left: sub.sms_credits - 1
    });

  } catch (err) {
    return res.status(500).json({ error: "SMS failed" });
  }
}