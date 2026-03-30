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
