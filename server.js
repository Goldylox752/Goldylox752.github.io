import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   CORE CONFIG
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  [
    "function mintSIM(address to, string memory tokenURI) returns (uint256)"
  ],
  wallet
);

/* =========================
   UTIL: SAFE RESPONSE
========================= */

function fail(res, message, code = 400) {
  return res.status(code).json({ success: false, error: message });
}

/* =========================
   1. CREATE ORDER (LEAD ENTRY POINT)
========================= */

app.post("/create-order", async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) return fail(res, "Missing wallet address");

    const orderId = uuidv4();

    const { error } = await supabase.from("orders").insert([
      {
        id: orderId,
        wallet: walletAddress,
        status: "pending",
        created_at: new Date().toISOString()
      }
    ]);

    if (error) return fail(res, error.message, 500);

    return res.json({
      success: true,
      orderId
    });

  } catch (err) {
    return fail(res, "Order creation failed", 500);
  }
});

/* =========================
   2. VERIFY PAYMENT + MINT SIM (CORE REVENUE LOGIC)
========================= */

app.post("/verify-payment", async (req, res) => {
  try {
    const { orderId, walletAddress } = req.body;

    if (!orderId || !walletAddress) {
      return fail(res, "Missing orderId or wallet");
    }

    // 🔒 fetch order
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error || !order) return fail(res, "Order not found", 404);

    // 🧠 prevent double minting (IMPORTANT FIX)
    if (order.status === "completed") {
      return fail(res, "Already processed", 409);
    }

    /* =========================
       PAYMENT CHECK (HOOK POINT)
       Replace with Stripe / crypto webhook
    ========================= */

    const paymentVerified = true;

    if (!paymentVerified) {
      return fail(res, "Payment not verified", 402);
    }

    /* =========================
       SIM GENERATION
    ========================= */

    const simNumber =
      "+1-780-" + Math.floor(1000000 + Math.random() * 9000000);

    const tokenURI = `https://your-api.com/metadata/${orderId}.json`;

    /* =========================
       BLOCKCHAIN MINT
    ========================= */

    const tx = await contract.mintSIM(walletAddress, tokenURI);
    await tx.wait();

    /* =========================
       UPDATE DATABASE
    ========================= */

    await supabase
      .from("orders")
      .update({
        status: "completed",
        sim_number: simNumber,
        token_uri: tokenURI,
        tx_hash: tx.hash,
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    return res.json({
      success: true,
      orderId,
      simNumber,
      tokenURI,
      txHash: tx.hash
    });

  } catch (err) {
    console.error(err);
    return fail(res, "Mint process failed", 500);
  }
});

/* =========================
   3. GET ORDER STATUS
========================= */

app.get("/order/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return fail(res, "Order not found", 404);

    return res.json({
      success: true,
      order: data
    });

  } catch (err) {
    return fail(res, "Fetch failed", 500);
  }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    system: "Revenue OS Core v2"
  });
});

/* =========================
   START SERVER
========================= */

app.listen(3000, () => {
  console.log("🚀 Revenue OS running on port 3000");
});