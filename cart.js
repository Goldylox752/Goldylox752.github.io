// cart.js
const products = [
  { name: "$15 Plan", priceCAD: 15, btc: 0.001 },
  { name: "$20 Plan", priceCAD: 20, btc: 0.0015 },
  { name: "$25 Plan", priceCAD: 25, btc: 0.002, stripe: "https://buy.stripe.com/fZufZa9KXdX65RJgLK2ZO06" },
  { name: "$30 Plan", priceCAD: 30, btc: 0.0025 },
  { name: "$35 Plan", priceCAD: 35, btc: 0.003 },
  { name: "$40 Plan", priceCAD: 40, btc: 0.0035, stripe: "https://buy.stripe.com/14A28k3mz4mw93Vanm2ZO07" },
  { name: "$50 Plan", priceCAD: 50, btc: 0.004 },
  { name: "$60 Plan", priceCAD: 60, btc: 0.005 },
  { name: "$70 Plan", priceCAD: 70, btc: 0.006 },
  { name: "$100 Plan", priceCAD: 100, btc: 0.008 }
];

let cart = [];

function renderProducts() {
  const list = document.getElementById("product-list");
  products.forEach((p, index) => {
    const div = document.createElement("div");
    div.className = "plan";
    div.innerHTML = `
      <h3>${p.name}</h3>
      <p>Price: $${p.priceCAD} CAD</p>
      <button onclick="addToCart(${index})">Add to Cart</button>
      <a href="bitcoin:bc1qegcga7mxckqh69jr7wwfvy4e3w554ycceeur3w?amount=${p.btc}" target="_blank">
        <button>Pay with BTC</button>
      </a>
      ${p.stripe ? `<a href="${p.stripe}" target="_blank"><button>Pay with Stripe</button></a>` : ""}
      <img src="btc_${p.priceCAD}.png" alt="Bitcoin QR Code for ${p.name}" style="width:150px;">
    `;
    list.appendChild(div);
  });
}

function addToCart(index) {
  cart.push(products[index]);
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const cartDiv = document.getElementById("cart");
  cartDiv.innerHTML = "";
  if(cart.length === 0){
    cartDiv.innerHTML = "<p>No items in cart</p>";
    document.getElementById("checkout-btn").style.display = "none";
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
  document.getElementById("checkout-btn").style.display = "inline-block";

  document.getElementById("checkout-btn").onclick = () => alert("Proceed to Stripe or BTC checkout!");
}

renderProducts();