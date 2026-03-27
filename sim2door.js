let provider;
let signer;
let contract;

// Replace with your deployed contract info
const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE";
const CONTRACT_ABI = [
  /* Paste ABI JSON from Remix here */
];

const connectBtn = document.getElementById('connectWallet');
const walletAddressEl = document.getElementById('walletAddress');
const buyBtn = document.getElementById('buySim');
const purchaseStatus = document.getElementById('purchaseStatus');

// Connect wallet
connectBtn.addEventListener('click', async () => {
    if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = await provider.getSigner();
        const address = await signer.getAddress();
        walletAddressEl.textContent = 'Connected Wallet: ' + address;

        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        try {
            const price = await contract.price();
            buyBtn.textContent = `Buy SIM NFT (${ethers.formatEther(price)} ETH)`;
        } catch (err) { console.error(err); }
    } else {
        walletAddressEl.textContent = 'No Web3 wallet detected. Install MetaMask.';
    }
});

// Buy & Mint NFT
buyBtn.addEventListener('click', async () => {
    if (!signer || !contract) { purchaseStatus.textContent = 'Connect your wallet first!'; return; }

    try {
        const price = await contract.price();
        const tx = await contract.mint({ value: price });
        purchaseStatus.textContent = `Transaction sent: ${tx.hash}`;
        await tx.wait();
        purchaseStatus.textContent = `✅ SIM NFT minted successfully! View on Etherscan: https://goerli.etherscan.io/tx/${tx.hash}`;
    } catch (err) {
        console.error(err);
        if (err.code === 4001) purchaseStatus.textContent = 'Transaction rejected by user.';
        else purchaseStatus.textContent = 'Transaction failed: ' + err.message;
    }
});