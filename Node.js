// generate-sim2door-full.js
// All-in-one generator for SIM2Door site with hero images and logo placeholders

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// ===== FOLDERS =====
const outputDir = path.join(__dirname, 'SIM2Door');
const assetsCssDir = path.join(outputDir, 'assets/css');
const assetsJsDir = path.join(outputDir, 'assets/js');
const assetsImagesDir = path.join(outputDir, 'assets/images');

[outputDir, assetsCssDir, assetsJsDir, assetsImagesDir].forEach(dir=>{
    if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true});
});

// ===== CSS =====
const cssContent = `
body{margin:0;font-family:Arial,sans-serif;color:#222;background:#fff;}
header{background:#000;color:#fff;padding:30px;text-align:center;}
header img{max-height:60px;margin-bottom:10px;}
header h1{margin:0;font-size:36px;}
header p{font-size:18px;margin-top:10px;}
nav{margin-top:15px;display:flex;flex-wrap:wrap;justify-content:center;}
nav a{margin:5px 8px;color:#fff;text-decoration:none;font-weight:bold;padding:6px 10px;background:#222;border-radius:4px;}
nav a:hover{text-decoration:underline;background:#444;}
.hero{color:#fff;text-align:center;padding:80px 20px;position:relative;}
.hero h2{font-size:42px;margin-bottom:20px;}
.hero p{font-size:20px;}
.button{display:inline-block;padding:15px 40px;margin-top:20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;font-size:18px;}
.button:hover{opacity:0.9;}
.section{padding:60px 20px;text-align:center;max-width:1200px;margin:auto;}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:25px;margin-top:40px;}
.feature{background:#f5f5f5;padding:25px;border-radius:8px;color:#222;}
footer{background:#000;color:#fff;text-align:center;padding:30px;margin-top:50px;}
.sticky-order{position:fixed;bottom:15px;right:15px;z-index:999;background:#000;color:#fff;padding:15px 25px;border-radius:6px;font-size:18px;text-decoration:none;box-shadow:0 5px 15px rgba(0,0,0,0.3);}
.countdown{font-size:20px;color:red;font-weight:bold;margin-top:15px;}
`;
fs.writeFileSync(path.join(assetsCssDir,'styles.css'),cssContent,'utf-8');

// ===== JS =====
const jsContent = `
// Show order popup
function openOffer(){document.getElementById('offerPopup').style.display='block';}

// Exit-intent popup
document.addEventListener('mouseout', function(e){
    if(e.clientY<0) openOffer();
});

// Countdown simulation
let stock=20;
function updateCountdown(){
    const countdown = document.querySelectorAll('.countdown');
    countdown.forEach(c => c.textContent=\`Hurry! Only \${stock} SIM cards left today!\`);
    if(stock>0){stock--; setTimeout(updateCountdown,5000);}
}
updateCountdown();
`;
fs.writeFileSync(path.join(assetsJsDir,'main.js'),jsContent,'utf-8');

// ===== CITIES =====
const cities = [
  { name:'Toronto', file:'sim-card-toronto.html' },
  { name:'Vancouver', file:'sim-card-vancouver.html' },
  { name:'Montreal', file:'sim-card-montreal.html' },
  { name:'Ottawa', file:'sim-card-ottawa.html' },
  { name:'Winnipeg', file:'sim-card-winnipeg.html' },
  { name:'Halifax', file:'sim-card-halifax.html' },
  { name:'Quebec', file:'sim-card-quebec.html' },
  { name:'Calgary', file:'sim-card-calgary.html' },
  { name:'Edmonton', file:'sim-card-edmonton.html' },
  { name:'Mississauga', file:'sim-card-mississauga.html' },
  { name:'Surrey', file:'sim-card-surrey.html' },
  { name:'Brampton', file:'sim-card-brampton.html' },
  { name:'Laval', file:'sim-card-laval.html' },
  { name:'London', file:'sim-card-london.html' },
  { name:'Victoria', file:'sim-card-victoria.html' },
  { name:'Kitchener', file:'sim-card-kitchener.html' },
  { name:'Windsor', file:'sim-card-windsor.html' }
];

// ===== HERO IMAGE GENERATOR =====
function generateHeroImage(text, filename){
    const width = 1200;
    const height = 500;
    const canvas = createCanvas(width,height);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0,0,width,height);
    gradient.addColorStop(0,'#00aaff');
    gradient.addColorStop(1,'#0057ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,width,height);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0,0,width,height);

    ctx.fillStyle = '#fff';
    ctx.font='bold 60px Arial';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(text,width/2,height/2);

    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(path.join(assetsImagesDir,filename),buffer);
}

// Logo placeholder
generateHeroImage('SIM2Door Logo','logo.png');
// Homepage hero
generateHeroImage('SIM2Door Canada','hero-canada.jpg');
// City hero images
cities.forEach(c=>{
    const fileName = `hero-${c.name.toLowerCase().replace(/ /g,'-')}.jpg`;
    generateHeroImage(c.name,fileName);
});

// ===== HTML GENERATOR =====
function generatePage(title, city='Canada', heroImage='hero-canada.jpg'){
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="Order $20 prepaid SIM cards delivered in ${city}. Works with Lucky Mobile, Freedom Mobile, Public Mobile. Fast delivery and no contract.">
<link rel="stylesheet" href="assets/css/styles.css">
</head>
<body>

<header>
<img src="assets/images/logo.png" alt="SIM2Door Logo">
<h1>SIM2Door ${city}</h1>
<p>Cheap Prepaid SIM Cards Delivered in ${city}</p>
<nav>
${cities.map(c=>`<a href="${c.file}">${c.name}</a>`).join('')}
</nav>
</header>

<section class="hero" style="background:url('assets/images/${heroImage}') center/cover no-repeat;">
<h2>Get Your $20 SIM Card Delivered in ${city}</h2>
<p>Works with Lucky Mobile, Freedom Mobile, and Public Mobile. No contract, no credit check.</p>
<p class="countdown">Hurry! Only 20 SIM cards left today!</p>
<a href="#" class="button" onclick="openOffer()">Order Your SIM Now →</a>
</section>

<section class="section">
<h2>Why Choose SIM2Door</h2>
<div class="features">
<div class="feature"><h3>$20 SIM Cards</h3><p>Affordable prepaid SIM cards delivered fast.</p></div>
<div class="feature"><h3>Fast Delivery</h3><p>Ships across ${city} quickly and safely.</p></div>
<div class="feature"><h3>No Contracts</h3><p>Easy activation, no credit check.</p></div>
<div class="feature"><h3>Works With Major Carriers</h3><p>Compatible with Lucky Mobile, Freedom Mobile, and Public Mobile.</p></div>
</div>
</section>

<section class="section">
<h2>Protect Your Data Online</h2>
<p>Stay secure while browsing public Wi-Fi and manage your passwords safely.</p>
<a href="https://go.nordvpn.net/aff_c?offer_id=15&aff_id=" target="_blank" rel="nofollow sponsored" class="button">Get NordVPN</a>
<a href="https://go.nordpass.io/aff_c?offer_id=488&aff_id=" target="_blank" rel="nofollow sponsored" class="button" style="background:#0057ff;">Get NordPass</a>
</section>

<div id="offerPopup" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;">
<div style="background:#fff;padding:30px;max-width:400px;margin:100px auto;text-align:center;border-radius:10px;">
<h2>Complete Your Order</h2>
<p>Get your SIM now and optionally secure your connection with VPN or password manager.</p>
<a href="https://go.nordvpn.net/aff_c?offer_id=15&aff_id=" target="_blank" rel="nofollow sponsored" class="button">Get NordVPN</a><br><br>
<a href="https://go.nordpass.io/aff_c?offer_id=488&aff_id=" target="_blank" rel="nofollow sponsored" class="button" style="background:#0057ff;">Get NordPass</a><br><br>
<a href="https://buy.stripe.com/fZufZa9KXdX65RJgLK2ZO06" class="button">Continue to Checkout →</a>
</div>
</div>

<a href="#" class="sticky-order" onclick="openOffer()">Order SIM Now</a>

<footer>
<p>© 2026 SIM2Door ${city}. All rights reserved.</p>
<p style="font-size:12px;">*We may earn commissions from affiliate links.</p>
</footer>

<script src="assets/js/main.js"></script>
</body>
</html>`;
}

// Generate homepage
fs.writeFileSync(path.join(outputDir,'index.html'),generatePage('SIM2Door Canada','Canada','hero-canada.jpg'),'utf-8');

// Generate city pages
cities.forEach(c=>{
    const heroFile = `hero-${c.name.toLowerCase().replace(/ /g,'-')}.jpg`;
    fs.writeFileSync(path.join(outputDir,c.file),generatePage(`SIM2Door ${c.name}`,c.name,heroFile),'utf-8');
});

console.log('✅ SIM2Door full website generated with hero images, logo, CSS & JS!');