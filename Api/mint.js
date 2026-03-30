import express from "express";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ✅ Supabase (use ENV)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 🔗 Ethereum RPC
const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");

// 🔒 Contract
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const CONTRACT_ABI = [
  "function getMintPrice() view returns (uint256)",
  "function mint() payable"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

app.post("/api/mint", async (req, res) => {
  const { wallet, txHash } = req.body;

  if (!wallet || !txHash) {
    return res.status(400).json({ error: "Missing wallet or txHash" });
  }

  try {
    // ✅ Prevent reuse
    const { data: existing } = await supabase
      .from("sims")
      .select("id")
      .eq("tx_hash", txHash)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: "Transaction already used" });
    }

    // ✅ Get tx + receipt
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!tx || !receipt) {
      return res.status(400).json({ error: "Invalid transaction" });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction failed" });
    }

    // ✅ Wallet match
    if (tx.from.toLowerCase() !== wallet.toLowerCase()) {
      return res.status(400).json({ error: "Wallet mismatch" });
    }

    // ✅ Contract match
    if (!tx.to || tx.to.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
      return res.status(400).json({ error: "Not sent to contract" });
    }

    // ✅ Price check
    const mintPrice = await contract.getMintPrice();

    if (tx.value < mintPrice) {
      return res.status(400).json({ error: "Insufficient payment" });
    }

    // ✅ Decode function
    const iface = new ethers.Interface(CONTRACT_ABI);
    const decoded = iface.parseTransaction({ data: tx.data });

    if (!decoded || decoded.name !== "mint") {
      return res.status(400).json({ error: "Invalid function call" });
    }

    // ✅ Get available SIM
    const { data: sims, error } = await supabase
      .from("sims")
      .select("*")
      .eq("status", "available")
      .limit(1);

    if (error || !sims || sims.length === 0) {
      return res.status(400).json({ error: "No SIMs available" });
    }

    const sim = sims[0];

    // ✅ Assign SIM
    await supabase
      .from("sims")
      .update({
        status: "used",
        assigned_to: wallet,
        tx_hash: txHash
      })
      .eq("id", sim.id);

    // ✅ Success
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

app.listen(3000, () => console.log("🚀 API running on port 3000"));