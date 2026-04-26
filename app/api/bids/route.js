import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();

  const { job_id, contractor_id, amount, user_paid } = body;

  // 🔐 NEVER trust frontend payment flag
  const { data: user } = await supabase
    .from("users")
    .select("paid")
    .eq("id", contractor_id)
    .single();

  if (!user?.paid) {
    return Response.json(
      { error: "Payment required" },
      { status: 403 }
    );
  }

  // ❌ block bids if auction closed
  const { data: job } = await supabase
    .from("jobs")
    .select("status")
    .eq("id", job_id)
    .single();

  if (job?.status !== "live") {
    return Response.json(
      { error: "Auction closed" },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("bids")
    .insert([{ job_id, contractor_id, amount }])
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ bid: data });
}