import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();

  const { job_id, contractor_id, amount, message } = body;

  // Check if auction is still open
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", job_id)
    .single();

  if (!job || job.status !== "open") {
    return Response.json(
      { error: "Auction closed" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("bids")
    .insert([
      {
        job_id,
        contractor_id,
        amount,
        message,
      },
    ])
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ bid: data });
}