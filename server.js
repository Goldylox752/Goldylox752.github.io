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

// 🔐 ENV
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Your deployed contract
const contractAddress = process.env.CONTRACT_ADDRESS;

const abi = [
  "function mintSIM(address to, string memory tokenURI) public returns (uint256)"
];

const contract = new ethers.Contract(contractAddress, abi, wallet);


// 📦 1. CREATE ORDER
app.post("/create-order", async (req, res) => {
  const { walletAddress } = req.body;

  const orderId = uuidv4();

  const { data, error } = await supabase
    .from("orders")
    .insert([
      {
        id: orderId,
        wallet: walletAddress,
        status: "pending"
      }
    ]);

  if (error) return res.status(500).json(error);

  res.json({ orderId });
});


// 💰 2. VERIFY PAYMENT (SIMULATED OR REAL)
app.post("/verify-payment", async (req, res) => {
  const { orderId, walletAddress } = req.body;

  // TODO: Replace with real crypto payment verification
  const paymentVerified = true;

  if (!paymentVerified) {
    return res.status(400).json({ error: "Payment not verified" });
  }

  // 📱 Assign SIM (mock for now)
  const simNumber = "+1-780-" + Math.floor(1000000 + Math.random() * 9000000);

  // 🧾 Metadata
  const tokenURI = `https://your-api.com/metadata/${orderId}.json`;

  try {
    // 🚀 Mint NFT
    const tx = await contract.mintSIM(walletAddress, tokenURI);
    await tx.wait();

    // 💾 Save in DB
    await supabase.from("orders").update({
      status: "completed",
      sim_number: simNumber,
      token_uri: tokenURI
    }).eq("id", orderId);

    res.json({
      success: true,
      simNumber,
      tokenURI
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Mint failed" });
  }
});


// 📊 3. GET ORDER
app.get("/order/:id", async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).json(error);

  res.json(data);
});


app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});