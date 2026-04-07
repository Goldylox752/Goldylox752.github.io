function goToOffer(button = "default") {

  console.log("🔥 BUTTON CLICKED:", button);

  const fallback = "https://go.saily.site/aff_c?offer_id=101&aff_id=13276";

  if (!loaded) {
    console.warn("⏳ Not loaded yet");
    window.open(fallback, '_blank');
    return;
  }

  const offer = pickOffer();

  if (!offer) {
    console.warn("⚠️ No offer");
    window.open(fallback, '_blank');
    return;
  }

  console.log("🎯 Redirecting to:", offer.link);

  trackClick(button, offer.name);

  window.open(offer.link, '_blank');
}


const supabase = window.supabase.createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_PUBLIC_ANON_KEY'
);

let offers = [];
let loaded = false;

// 🔄 LOAD OFFERS FROM SUPABASE
async function loadOffers() {
  try {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .eq('site', 'sim2door')   // make sure this matches your DB EXACTLY
      .eq('active', true);

    if (error) {
      console.error("❌ Supabase error:", error);
      return;
    }

    offers = data || [];
    loaded = true;

    console.log("✅ Offers loaded:", offers);

  } catch (err) {
    console.error("❌ Load failed:", err);
  }
}

// 🔁 RETRY IF LOAD FAILS (network slow etc)
setTimeout(() => {
  if (!loaded) {
    console.warn("🔁 Retrying offer load...");
    loadOffers();
  }
}, 2000);

// 🎯 PICK RANDOM OFFER
function pickOffer() {
  if (!offers.length) return null;
  return offers[Math.floor(Math.random() * offers.length)];
}

// 📊 TRACK CLICK (non-blocking)
async function trackClick(button, offerName) {
  try {
    await supabase.from('clicks').insert([{
      site: "sim2door",
      button: button,
      offer: offerName
    }]);
  } catch (err) {
    console.warn("⚠️ Tracking failed:", err);
  }
}

// 🚀 MAIN BUTTON HANDLER
function goToOffer(button = "default") {

  const fallback = "https://go.saily.site/aff_c?offer_id=101&aff_id=13276";

  // If still loading → fallback
  if (!loaded) {
    console.warn("⏳ Offers still loading, using fallback");
    window.open(fallback, '_blank');
    return;
  }

  const offer = pickOffer();

  // If no offers → fallback
  if (!offer) {
    console.warn("⚠️ No offers found, using fallback");
    window.open(fallback, '_blank');
    return;
  }

  console.log("🎯 Selected offer:", offer.name);

  // Track click (non-blocking)
  trackClick(button, offer.name);

  // Redirect
  window.open(offer.link, '_blank');
}

// 🚀 INIT
loadOffers();