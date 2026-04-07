const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);



function goToOffer(button = "default") {

  console.log("🔥 BUTTON CLICKED:", button);

  const fallback = "https://go.saily.site/aff_c?offer_id=101&aff_id=13276";

  // ⏳ If not loaded yet
  if (!loaded) {
    console.warn("⏳ Offers not loaded → using fallback");
    window.location.href = fallback;
    return;
  }

  const offer = pickOffer();

  // ❌ No offers
  if (!offer) {
    console.warn("⚠️ No offers → using fallback");
    window.location.href = fallback;
    return;
  }

  console.log("🎯 Redirecting to:", offer.link);

  // Track (don’t block redirect)
  trackClick(button, offer.name);

  // ✅ MOBILE SAFE REDIRECT
  window.location.href = offer.link;
}