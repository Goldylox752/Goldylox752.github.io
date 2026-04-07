const supabaseUrl = 'https://ipumbyywyzrbinwtejri.supabase.co';
const supabaseKey = 'YOUR_ANON_KEY';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let offers = [];
let loaded = false;

// LOAD OFFERS
async function loadOffers() {
  try {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
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

// PICK RANDOM OFFER
function pickOffer() {
  if (!offers.length) return null;
  return offers[Math.floor(Math.random() * offers.length)];
}

// TRACK CLICK (SAFE)
function trackClick(button, offerName) {
  try {
    supabase.from('clicks').insert([{
      button: button,
      offer: offerName
    }]);
  } catch (err) {
    console.warn("Tracking failed:", err);
  }
}

// MAIN BUTTON FUNCTION
function goToOffer(button = "default") {

  console.log("🔥 BUTTON CLICKED:", button);

  const fallback = "https://go.saily.site/aff_c?offer_id=101&aff_id=13276";

  // If not loaded yet
  if (!loaded) {
    console.warn("⏳ Not loaded → fallback");
    window.location.href = fallback;
    return;
  }

  const offer = pickOffer();

  // No offer
  if (!offer) {
    console.warn("⚠️ No offer → fallback");
    window.location.href = fallback;
    return;
  }

  console.log("🎯 Redirecting:", offer.link);

  trackClick(button, offer.name);

  // MOBILE SAFE
  window.location.href = offer.link;
}

// INIT
loadOffers();