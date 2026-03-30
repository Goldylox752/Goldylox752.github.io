import express from 'express';
import { ethers } from 'ethers';

const app = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

const nftAddress = "YOUR_NFT_CONTRACT";
const nftABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];
const nftContract = new ethers.Contract(nftAddress, nftABI, provider);

// Listen for NFT mint
nftContract.on("Transfer", async (from, to, tokenId) => {
  if (from === ethers.ZeroAddress) {
    console.log(`✅ NFT minted! TokenID: ${tokenId}, Wallet: ${to}`);

    // Trigger SIM activation
    await activateSIM(to, tokenId);

    // Optional: reward MTK
    await mintMTK(to, "50"); // 50 MTK
  }
});

async function activateSIM(userWallet, tokenId) {
  // Here you generate a SIM code
  const simCode = generateSIMCode();

  console.log(`SIM code for ${userWallet}: ${simCode}`);

  // Save to database
  // Example: MongoDB or JSON file
  // { wallet: userWallet, tokenId, simCode, activated: true }

  // Optionally: send email or display in user dashboard
}

function generateSIMCode() {
  // Random 8-digit code
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

async function mintMTK(userWallet, amount) {
  // Connect to MTK contract
  const tokenAddress = "YOUR_TOKEN_CONTRACT";
  const tokenABI = ["function mint(address to, uint256 amount)"];
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

  const tx = await tokenContract.mint(userWallet, ethers.parseEther(amount));
  await tx.wait();
  console.log(`Minted ${amount} MTK for ${userWallet}`);
}

app.listen(3000, () => {
  console.log("Backend listening on port 3000");
});


const express = require("express");
const stripe = require("stripe")("sk_live_YourSecretKeyHere");
const app = express();
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  const cartItems = req.body.cart;

  const line_items = cartItems.map(item => ({
    price_data: {
      currency: "cad",
      product_data: { name: item.name },
      unit_amount: item.priceCAD * 100
    },
    quantity: 1
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items,
    mode: "payment",
    success_url: "https://goldylox752.github.io/success.html",
    cancel_url: "https://goldylox752.github.io"
  });

  res.json({ url: session.url });
});

app.listen(4242, () => console.log("Server running on port 4242"));
