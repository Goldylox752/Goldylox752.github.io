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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, body, userId } = req.body;

  if (!to || !body || !userId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // -----------------------------
  // 1. CHECK USER ACCESS / PLAN
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
  // 2. BASIC RATE LIMIT (SIMPLE SAFETY)
  // -----------------------------
  const { count } = await supabase
    .from("sms_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (count > 20 && sub.plan !== "enterprise") {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  // -----------------------------
  // 3. SEND SMS VIA TWILIO
  // -----------------------------
  try {
    const message = await client.messages.create({
      body,
      to,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    // -----------------------------
    // 4. LOG USAGE
    // -----------------------------
    await supabase.from("sms_logs").insert({
      user_id: userId,
      to_number: to,
      body,
      message_sid: message.sid,
      status: "sent"
    });

    return res.json({ success: true, sid: message.sid });

  } catch (err) {
    console.error(err);

    await supabase.from("sms_logs").insert({
      user_id: userId,
      to_number: to,
      body,
      status: "failed"
    });

    return res.status(500).json({ error: "SMS failed" });
  }
}