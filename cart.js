const products = [
  { name: "$15 Plan", priceCAD: 15 },
  { name: "$20 Plan", priceCAD: 20 },
  { name: "$25 Plan", priceCAD: 25 },
  { name: "$30 Plan", priceCAD: 30 },
  { name: "$35 Plan", priceCAD: 35 },
  { name: "$40 Plan", priceCAD: 40 },
  { name: "$50 Plan", priceCAD: 50 },
  { name: "$60 Plan", priceCAD: 60 },
  { name: "$70 Plan", priceCAD: 70 },
  { name: "$100 Plan", priceCAD: 100 }
];

let cart = [];

// Render product list
function renderProducts() {
  const list = document.getElementById("product-list");
  products.forEach((p, index) => {
    const div = document.createElement("div");
    div.className = "plan";
    div.innerHTML = `
      <h3>${p.name}</h3>
      <p>Price: $${p.priceCAD} CAD</p>
      <button onclick="addToCart(${index})">Add to Cart</button>
    `;
    list.appendChild(div);
  });
}

// Add to cart
function addToCart(index) {
  cart.push(products[index]);
  renderCart();
}

// Remove from cart
function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

// Render cart
function renderCart() {
  const cartDiv = document.getElementById("cart");
  cartDiv.innerHTML = "";
  if(cart.length === 0){
    cartDiv.innerHTML = "<p>No items in cart</p>";
    document.getElementById("payment-choice").style.display = "none";
    document.getElementById("btc-email-container").style.display = "none";
    document.getElementById("btc-qr").innerHTML = "";
    return;
  }

  let total = 0;
  cart.forEach((item, i) => {
    total += item.priceCAD;
    const div = document.createElement("div");
    div.innerHTML = `
      ${item.name} - $${item.priceCAD} CAD
      <button onclick="removeFromCart(${i})">Remove</button>
    `;
    cartDiv.appendChild(div);
  });

  const totalDiv = document.createElement("p");
  totalDiv.innerHTML = `<strong>Total: $${total} CAD</strong>`;
  cartDiv.appendChild(totalDiv);

  document.getElementById("payment-choice").style.display = "block";
  document.getElementById("btc-email-container").style.display = "block";
}

// Stripe Checkout
document.getElementById("pay-stripe-btn").onclick = async () => {
  if(cart.length === 0) return alert("Cart is empty!");
  const response = await fetch("/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cart })
  });
  const session = await response.json();
  window.location.href = session.url;
};

// Bitcoin Checkout with Email Confirmation
document.getElementById("pay-btc-btn").onclick = async () => {
  if(cart.length === 0) return alert("Cart is empty!");
  const email = document.getElementById("btc-email").value;
  if(!email) return alert("Please enter your email!");

  let totalCAD = cart.reduce((sum, item) => sum + item.priceCAD, 0);

  // Fetch BTC rate
  const rateResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=cad");
  const rateData = await rateResponse.json();
  const btcRate = rateData.bitcoin.cad;
  const totalBTC = (totalCAD / btcRate).toFixed(8);
  const btcAddress = "bc1qegcga7mxckqh69jr7wwfvy4e3w554ycceeur3w";

  // Display BTC QR + Copy Button
  const qrDiv = document.getElementById("btc-qr");
  qrDiv.innerHTML = `
    <p>Pay <strong>${totalBTC} BTC</strong> to the address:</p>
    <p id="btc-address">${btcAddress}</p>
    <button id="copy-btc-btn">Copy BTC Address</button>
    <img src="https://chart.googleapis.com/chart?cht=qr&chl=bitcoin:${btcAddress}?amount=${totalBTC}&chs=200x200" alt="BTC QR Code">
  `;

  document.getElementById("copy-btc-btn").onclick = () => {
    navigator.clipboard.writeText(btcAddress)
      .then(() => alert("BTC address copied to clipboard!"))
      .catch(() => alert("Failed to copy BTC address."));
  };

  // Send confirmation email via EmailJS
  const emailParams = {
    to_email: email,
    plan_list: cart.map(item => `${item.name} - $${item.priceCAD}`).join(", "),
    total_cad: totalCAD,
    total_btc: totalBTC,
    btc_address: btcAddress
  };

  emailjs.send('YOUR_SERVICE_ID','YOUR_TEMPLATE_ID', emailParams)
    .then(() => alert("Confirmation email sent! Check your inbox for SIM instructions."))
    .catch(() => alert("Failed to send email."));
};

renderProducts();