const stripePublicKey = "YOUR_STRIPE_PUBLIC_KEY";
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