import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const supabase = createClient(
  "https://ipumbyywyzrbinwtejri.supabase.co",
  "YOUR_SERVICE_ROLE_KEY"
);

app.post("/api/mint", async (req, res) => {
  const { wallet, txHash } = req.body;

  try {
    // ✅ Get available SIM
    const { data, error } = await supabase
      .from("sims")
      .select("*")
      .eq("status", "available")
      .limit(1);

    if (error || !data || data.length === 0) {
      return res.status(400).json({ error: "No SIMs left" });
    }

    const sim = data[0];

    // ✅ Assign SIM
    const { error: updateError } = await supabase
      .from("sims")
      .update({
        status: "used",
        assigned_to: wallet,
        tx_hash: txHash
      })
      .eq("id", sim.id);

    if (updateError) throw updateError;

    // ✅ Return SIM
    res.json({
      success: true,
      sim: sim.iccid,
      tokenId: sim.id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => console.log("🚀 API running"));