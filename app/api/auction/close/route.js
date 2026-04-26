import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const { job_id } = await req.json();

  // Get lowest bid (winner logic)
  const { data: bids } = await supabase
    .from("bids")
    .select("*")
    .eq("job_id", job_id)
    .order("amount", { ascending: true });

  if (!bids || bids.length === 0) {
    return Response.json({ error: "No bids" }, { status: 400 });
  }

  const winner = bids[0];

  // Mark job as closed
  await supabase
    .from("jobs")
    .update({
      status: "closed",
    })
    .eq("id", job_id);

  return Response.json({
    winner,
  });
}