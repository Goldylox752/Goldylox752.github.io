<script src="https://cdn.jsdelivr.net/npm/ethers@6.7.0/dist/ethers.umd.min.js"></script>

<script>
// ================================
// CONFIG
// ================================
const API_BASE = window.location.origin;

// ================================
// STRIPE SUCCESS HANDLING
// ================================
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session_id");
const storedToken = localStorage.getItem("ns_subscription_token");

if (sessionId) {
  window.history.replaceState({}, document.title, window.location.pathname);

  if (!storedToken) {
    const banner = document.createElement("div");
    banner.textContent = "🎉 Payment successful — access unlocked.";

    Object.assign(banner.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#14532d",
      color: "#bbf7d0",
      padding: "12px 24px",
      borderRadius: "40px",
      fontWeight: "600",
      zIndex: "9999"
    });

    document.body.appendChild(banner);

    setTimeout(() => {
      banner.style.opacity = "0";
      banner.style.transition = "0.3s";
      setTimeout(() => banner.remove(), 300);
    }, 3000);
  }

  verifyPayment(sessionId);
}

// ================================
// VERIFY PAYMENT
// ================================
async function verifyPayment(session_id) {
  try {
    const res = await fetch(`${API_BASE}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id })
    });

    const data = await res.json();

    if (data.valid) {
      localStorage.setItem("ns_subscription_token", session_id);
      unlockUI();
    } else {
      console.warn("Payment not valid");
    }
  } catch (err) {
    console.error("Verify failed:", err);
  }
}

function unlockUI() {
  document.body.classList.add("unlocked");
}

// ================================
// STRIPE CHECKOUT
// ================================
async function startCheckout(plan) {
  try {
    const res = await fetch(`${API_BASE}/api/create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan,
        successUrl: window.location.origin + "?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: window.location.href
      })
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Checkout failed");
    }

  } catch (err) {
    console.error(err);
    alert("Payment error");
  }
}

// Hook buttons
document.querySelectorAll(".btn-buy").forEach(btn => {
  btn.addEventListener("click", () => {
    startCheckout(btn.dataset.plan);
  });
});


// ================================
// WEB3 (OPTIONAL - CLEANED)
// ================================
let provider, signer, nftContract, tokenContract;

const NFT_ADDRESS = "YOUR_NFT_CONTRACT";
const TOKEN_ADDRESS = "YOUR_TOKEN_CONTRACT";

const nftABI = [
  "function mint() payable",
  "function balanceOf(address) view returns (uint256)",
  "function mintPrice() view returns (uint256)"
];

const tokenABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Connect wallet
async function connectWallet() {
  if (!window.ethereum) {
    alert("Install MetaMask");
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();

  nftContract = new ethers.Contract(NFT_ADDRESS, nftABI, signer);
  tokenContract = new ethers.Contract(TOKEN_ADDRESS, tokenABI, signer);

  setStatus("✅ Wallet Connected");
}

// Check NFT ownership
async function checkNFT() {
  const user = await signer.getAddress();
  const balance = await nftContract.balanceOf(user);

  if (balance > 0) {
    setStatus("✅ SIM NFT detected");
  } else {
    setStatus("❌ No SIM NFT");
  }
}

// Mint NFT
async function mintNFT() {
  try {
    const price = await nftContract.mintPrice();
    const tx = await nftContract.mint({ value: price });

    setStatus("Minting...");

    await tx.wait();

    setStatus("✅ NFT Minted");
  } catch (err) {
    console.error(err);
    setStatus("❌ Mint failed");
  }
}

// Token payment
async function payWithToken() {
  try {
    const amount = document.getElementById("amount").value;

    const tx = await tokenContract.transfer(
      "YOUR_WALLET_ADDRESS",
      ethers.parseEther(amount)
    );

    setStatus("Processing payment...");
    await tx.wait();

    setStatus("✅ Payment successful");
  } catch (err) {
    console.error(err);
    setStatus("❌ Payment failed");
  }
}

// UI helper
function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.innerText = msg;
}
</script>