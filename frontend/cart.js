if (balance == 0) {
  alert("You need a SIM NFT");
  return;
}
let referralCode = new URLSearchParams(window.location.search).get('ref');
let discountPercent = referralCode ? 10 : 0;
let cart = JSON.parse(localStorage.getItem('cart')) || [];

const products = [
  {id:1,name:"1GB Prepaid SIM",price:15},
  {id:2,name:"5GB Prepaid SIM",price:35},
  {id:3,name:"Unlimited SIM",price:60}
];

// Render products and cart functions
// Stripe checkout
document.getElementById('pay-stripe-btn').addEventListener('click', async () => { /* fetch /create-stripe-session */ });
// Newton checkout
document.getElementById('pay-btc-btn').addEventListener('click', async () => { /* fetch /create-newton-payment */ });
// EmailJS activation
async function sendActivationEmail(email, simDetails) { /* ... */ }


import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

const contractAddress = "YOUR_CONTRACT_ADDRESS";

const abi = [
  "function mint() payable",
  "function mintPrice() view returns (uint256)"
];

export default function MintButton() {
  const { address } = useAccount();

  const mintNFT = async () => {
    if (!window.ethereum) return alert("Install wallet");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(contractAddress, abi, signer);

    const price = await contract.mintPrice();

    const tx = await contract.mint({
      value: price
    });

    await tx.wait();

    alert("NFT Minted 🚀");
  };

  return (
    <button onClick={mintNFT} className="btn">
      Buy SIM NFT
    </button>
  );
}
<h2>SIM2Door Web3 Dashboard</h2>

<button onclick="connectWallet()">Connect Wallet</button>

<br><br>

<button onclick="checkNFT()">Check SIM NFT</button>
<button onclick="mintNFT()">Mint SIM NFT</button>

<br><br>

<button onclick="getBalance()">Check MTK Balance</button>

<br><br>

<input id="amount" placeholder="MTK Amount">
<button onclick="payWithMTK()">Pay for Data</button>

<p id="status"></p>

<script src="https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.umd.min.js"></script>

<script>
let provider, signer;
let nftContract, tokenContract;

const NFT_ADDRESS = "YOUR_NFT_CONTRACT";
const TOKEN_ADDRESS = "YOUR_TOKEN_CONTRACT";

// NFT ABI
const nftABI = [
  "function mint() payable",
  "function balanceOf(address) view returns (uint256)",
  "function mintPrice() view returns (uint256)"
];

// Token ABI
const tokenABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

async function connectWallet() {
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();

  nftContract = new ethers.Contract(NFT_ADDRESS, nftABI, signer);
  tokenContract = new ethers.Contract(TOKEN_ADDRESS, tokenABI, signer);

  document.getElementById("status").innerText = "✅ Wallet Connected";
}

// ✅ Check if user owns SIM NFT
async function checkNFT() {
  const user = await signer.getAddress();
  const balance = await nftContract.balanceOf(user);

  if (balance > 0) {
    document.getElementById("status").innerText = "✅ SIM NFT detected";
  } else {
    document.getElementById("status").innerText = "❌ No SIM NFT";
  }
}

// 🎟 Mint NFT
async function mintNFT() {
  try {
    const price = await nftContract.mintPrice();

    const tx = await nftContract.mint({ value: price });

    document.getElementById("status").innerText = "Minting SIM...";

    await tx.wait();

    document.getElementById("status").innerText = "✅ SIM NFT Minted!";
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "❌ Mint failed";
  }
}

// 💰 Check MTK balance
async function getBalance() {
  const user = await signer.getAddress();
  const balance = await tokenContract.balanceOf(user);

  document.getElementById("status").innerText =
    "MTK Balance: " + ethers.formatEther(balance);
}

// 💳 Pay with MTK
async function payWithMTK() {
  try {
    const amount = document.getElementById("amount").value;

    const tx = await tokenContract.transfer(
      "YOUR_WALLET_ADDRESS",
      ethers.parseEther(amount)
    );

    document.getElementById("status").innerText = "Processing payment...";

    await tx.wait();

    document.getElementById("status").innerText = "✅ Payment successful";
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "❌ Payment failed";
  }
}
// after mint success
await tokenContract.mint(user, ethers.parseEther("50"));
</script>
