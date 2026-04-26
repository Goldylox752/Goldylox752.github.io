import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ----------------------------
// CONTRACTOR SCORING ENGINE
// ----------------------------
async function updateContractorScore(winnerId, bids) {
  for (const bid of bids) {
    const isWinner = bid.contractor_id === winnerId;

    const { data: user } = await supabase
      .from("users")
      .select("score, wins, losses, total_bids")
      .eq("id", bid.contractor_id)
      .single();

    if (!user) continue;

    // 🧠 base model
    let newScore = Number(user.score || 50);

    // 📊 activity reward (participation matters)
    newScore += 0.5;

    // 🏆 win/loss logic
    if (isWinner) {
      newScore += 5;
    } else {
      newScore -= 1;
    }

    // 🔒 clamp score
    newScore = Math.max(0, Math.min(100, newScore));

    await supabase
      .from("users")
      .update({
        score: newScore,
        wins: (user.wins || 0) + (isWinner ? 1 : 0),
        losses: (user.losses || 0) + (isWinner ? 0 : 1),
        total_bids: (user.total_bids || 0) + 1,
      })
      .eq("id", bid.contractor_id);
  }
}

// ----------------------------
// CRON: CLOSE AUCTIONS
// ----------------------------
export async function GET() {
  const now = new Date().toISOString();

  // 1. find expired auctions
  const { data: expiredJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "live")
    .lt("ends_at", now);

  if (!expiredJobs?.length) {
    return Response.json({ message: "No auctions to close" });
  }

  let closed = 0;

  // 2. process each auction
  for (const job of expiredJobs) {
    const { data: bids } = await supabase
      .from("bids")
      .select("*")
      .eq("job_id", job.id)
      .order("amount", { ascending: true });

    // ❌ no bids → expire
    if (!bids || bids.length === 0) {
      await supabase
        .from("jobs")
        .update({ status: "expired" })
        .eq("id", job.id);

      continue;
    }

    const winner = bids[0]; // lowest bid wins

    // 🏁 update job result
    await supabase
      .from("jobs")
      .update({
        status: "sold",
        winner_id: winner.contractor_id,
        winning_bid: winner.amount,
      })
      .eq("id", job.id);

    // 🧠 update contractor scores
    await updateContractorScore(winner.contractor_id, bids);

    closed++;
  }

  return Response.json({
    closed,
    updated: true,
  });
}