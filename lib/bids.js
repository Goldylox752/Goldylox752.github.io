import { supabase } from "./supabase";

// 🧠 FRONTEND BID FUNCTION
export async function placeBid({ jobId, user, amount }) {
  if (!user?.paid) {
    alert("Unlock bidding access first");
    return;
  }

  const { data, error } = await supabase.from("bids").insert([
    {
      job_id: jobId,
      contractor_id: user.id,
      amount: Number(amount),
    },
  ]);

  if (error) {
    console.error(error);
    alert("Bid failed");
    return;
  }

  return data;
}