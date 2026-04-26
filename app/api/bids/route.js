import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ----------------------------
// ANTI-SNIPING ENGINE
// ----------------------------
async function maybeExtendAuction(jobId, endsAt) {
  const now = Date.now();

  const ANTI_SNIPE_WINDOW = 2 * 60 * 1000; // 2 minutes
  const EXTEND_TIME = 2 * 60 * 1000; // +2 minutes

  const timeLeft = new Date(endsAt).getTime() - now;

  if (timeLeft <= ANTI_SNIPE_WINDOW) {
    const newEndsAt = new Date(
      new Date(endsAt).getTime() + EXTEND_TIME
    ).toISOString();

    await supabase
      .from("jobs")
      .update({ ends_at: newEndsAt })
      .eq("id", jobId);
  }
}

// ----------------------------
// BID ROUTE
// ----------------------------
export async function POST(req) {
  const body = await req.json();
  const { job_id, contractor_id, amount } = body;

  // 🔐 VERIFY PAYMENT SERVER-SIDE
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

  // 🔎 GET JOB (needed for anti-sniping)
  const { data: job } = await supabase
    .from("jobs")
    .select("status, ends_at")
    .eq("id", job_id)
    .single();

  if (!job || job.status !== "live") {
    return Response.json(
      { error: "Auction closed" },
      { status: 403 }
    );
  }

  // 🧾 INSERT BID
  const { data: bid, error } = await supabase
    .from("bids")
    .insert([
      {
        job_id,
        contractor_id,
        amount,
      },
    ])
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }

  // ⚡ ANTI-SNIPING TRIGGER (FIXED VERSION)
  await maybeExtendAuction(job_id, job.ends_at);

  return Response.json({ bid });
}