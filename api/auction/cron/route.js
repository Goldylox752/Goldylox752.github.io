import { createClient } from "@supabase/supabase-js";

// ============================
// SUPABASE CLIENT (SERVER ONLY)
// ============================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ server-only key
);

// ============================
// CONTRACTOR SCORING ENGINE
// ============================
async function updateContractorScores(winnerId: string, bids: any[]) {
  const updates = bids.map(async (bid) => {
    const contractorId = bid.contractor_id;
    const isWinner = contractorId === winnerId;

    const { data: user } = await supabase
      .from("users")
      .select("score, wins, losses, total_bids")
      .eq("id", contractorId)
      .single();

    if (!user) return;

    let score = Number(user.score ?? 50);

    // baseline engagement reward
    score += 0.5;

    // win/loss adjustment
    score += isWinner ? 5 : -1;

    // clamp score
    score = Math.max(0, Math.min(100, score));

    return supabase
      .from("users")
      .update({
        score,
        wins: (user.wins ?? 0) + (isWinner ? 1 : 0),
        losses: (user.losses ?? 0) + (isWinner ? 0 : 1),
        total_bids: (user.total_bids ?? 0) + 1,
      })
      .eq("id", contractorId);
  });

  await Promise.all(updates);
}

// ============================
// CLOSE AUCTIONS CRON HANDLER
// ============================
export async function GET() {
  const now = new Date().toISOString();

  // 1. fetch expired jobs
  const { data: expiredJobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "live")
    .lt("ends_at", now);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!expiredJobs?.length) {
    return Response.json({ message: "No auctions to close" });
  }

  let closed = 0;

  // 2. process auctions
  for (const job of expiredJobs) {
    const { data: bids } = await supabase
      .from("bids")
      .select("*")
      .eq("job_id", job.id)
      .order("amount", { ascending: true });

    // no bids → expire job
    if (!bids?.length) {
      await supabase
        .from("jobs")
        .update({ status: "expired" })
        .eq("id", job.id);

      continue;
    }

    const winner = bids[0];

    // mark job as sold
    await supabase
      .from("jobs")
      .update({
        status: "sold",
        winner_id: winner.contractor_id,
        winning_bid: winner.amount,
      })
      .eq("id", job.id);

    // update contractor scores
    await updateContractorScores(winner.contractor_id, bids);

    closed++;
  }

  return Response.json({
    success: true,
    closed_jobs: closed,
  });
}