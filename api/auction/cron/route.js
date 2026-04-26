import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET() {
  const now = new Date().toISOString();

  // 1. Find expired auctions still open
  const { data: expiredJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "live")
    .lt("ends_at", now);

  if (!expiredJobs?.length) {
    return Response.json({ message: "No auctions to close" });
  }

  // 2. Close each auction
  for (const job of expiredJobs) {
    const { data: bids } = await supabase
      .from("bids")
      .select("*")
      .eq("job_id", job.id)
      .order("amount", { ascending: true });

    if (!bids || bids.length === 0) {
      await supabase
        .from("jobs")
        .update({ status: "expired" })
        .eq("id", job.id);
      continue;
    }

    const winner = bids[0]; // lowest bid wins

    await supabase
      .from("jobs")
      .update({
        status: "sold",
        winner_id: winner.contractor_id,
        winning_bid: winner.amount,
      })
      .eq("id", job.id);
  }

  return Response.json({
    closed: expiredJobs.length,
  });
}