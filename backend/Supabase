import { createClient } from "@supabase/supabase-js";

/* =========================
   ENV SAFETY CHECK
========================= */
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables");
}

/* =========================
   CLIENT INIT
========================= */
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/* =========================
   ACCESS CHECK HELPER
   (used for your lock system)
========================= */
export async function checkAccess(userId) {
  if (!userId) return { valid: false };

  const { data, error } = await supabase
    .from("verified_sessions")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Supabase verify error:", error);
    return { valid: false };
  }

  return {
    valid: !!data,
    plan: data?.plan || null,
  };
}

/* =========================
   LOG EVENT (optional reuse)
========================= */
export async function logEvent(payload) {
  const { error } = await supabase
    .from("events")
    .insert([payload]);

  if (error) {
    console.error("Event log error:", error);
  }
}