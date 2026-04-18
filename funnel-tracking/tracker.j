<script>
function sendToVercelFunnel(){

  // 1. SESSION ID (persistent tracking)
  let session_id = localStorage.getItem("session_id");

  if (!session_id){
    session_id = crypto.randomUUID();
    localStorage.setItem("session_id", session_id);
  }

  // 2. GET UTM PARAMETERS
  const params = new URLSearchParams(window.location.search);

  const utm_source = params.get("utm_source") || "roofflow_ai";
  const utm_campaign = params.get("utm_campaign") || "organic";
  const utm_content = params.get("utm_content") || null;

  // 3. BUILD DESTINATION URL (your Vercel funnel)
  const url = new URL("https://goldylox752-github-io.vercel.app/");

  url.searchParams.set("session_id", session_id);
  url.searchParams.set("utm_source", utm_source);
  url.searchParams.set("utm_campaign", utm_campaign);
  url.searchParams.set("utm_content", utm_content);
  url.searchParams.set("from", "roofflow_ai");

  // 4. OPTIONAL: LOG FOR ANALYTICS
  console.log("🚀 Sending to Vercel funnel:", {
    session_id,
    utm_source,
    utm_campaign
  });

  // 5. REDIRECT USER
  window.location.href = url.toString();
}
</script>