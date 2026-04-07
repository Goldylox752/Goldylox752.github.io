const supabase = window.supabase.createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_PUBLIC_ANON_KEY'
);

let offers = [];

async function loadOffers() {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .eq('site', 'sim2door')
    .eq('active', true);

  if (data) {
    offers = data;
    console.log("Offers loaded:", offers.length);
  } else {
    console.error(error);
  }
}

function pickOffer() {
  if (!offers.length) return null;
  return offers[Math.floor(Math.random() * offers.length)];
}

async function trackClick(button, offerName) {
  await supabase.from('clicks').insert([{
    site: "sim2door",
    button: button,
    offer: offerName
  }]);
}

function goToOffer(button = "default") {
  const offer = pickOffer();

  if (!offer) {
    alert("Loading deal... try again");
    return;
  }

  trackClick(button, offer.name);

  window.open(offer.link, '_blank');
}

loadOffers();