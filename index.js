/* ===============================
   NORTHSKY SYSTEMS OS CORE.JS
   Funnel Tracking + Session Engine
   =============================== */

(function(){

  /* ===============================
     SESSION MANAGEMENT
  =============================== */

  function getSession(){
    let session_id = localStorage.getItem("ns_session_id");

    if(!session_id){
      session_id = crypto.randomUUID();
      localStorage.setItem("ns_session_id", session_id);
    }

    return session_id;
  }

  function getUser(){
    let user_id = localStorage.getItem("ns_user_id");

    if(!user_id){
      user_id = crypto.randomUUID();
      localStorage.setItem("ns_user_id", user_id);
    }

    return user_id;
  }

  /* ===============================
     UTM + SOURCE TRACKING
  =============================== */

  function getParams(){
    const p = new URLSearchParams(window.location.search);

    return {
      utm_source: p.get("utm_source") || "direct",
      utm_campaign: p.get("utm_campaign") || "none",
      utm_medium: p.get("utm_medium") || "organic",
      referrer: document.referrer || "none"
    };
  }

  /* ===============================
     EVENT TRACKING (LOG LAYER)
  =============================== */

  function track(event, data = {}){
    const payload = {
      event,
      data,
      session_id: getSession(),
      user_id: getUser(),
      timestamp: new Date().toISOString(),
      page: window.location.href,
      ...getParams()
    };

    console.log("TRACK:", payload);

    /* OPTIONAL: SEND TO BACKEND */
    /*
    fetch("https://YOUR_API_ENDPOINT/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).catch(()=>{});
    */
  }

  /* ===============================
     FUNNEL REDIRECT
  =============================== */

  function sendToFunnel(urlBase){

    const url = new URL(urlBase);

    url.searchParams.set("session_id", getSession());
    url.searchParams.set("user_id", getUser());

    const params = getParams();

    Object.keys(params).forEach(key=>{
      url.searchParams.set(key, params[key]);
    });

    url.searchParams.set("from", "northsky_os");

    track("funnel_redirect", { destination: urlBase });

    window.location.href = url.toString();
  }

  /* ===============================
     AUTO PAGE TRACK
  =============================== */

  document.addEventListener("DOMContentLoaded", ()=>{
    track("page_view");

    /* Track clicks on buttons */
    document.querySelectorAll(".btn").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        track("button_click", { text: btn.innerText });
      });
    });

    /* Track outbound links */
    document.querySelectorAll("a").forEach(link=>{
      link.addEventListener("click", ()=>{
        track("link_click", { href: link.href });
      });
    });
  });

  /* ===============================
     GLOBAL EXPORTS
  =============================== */

  window.NorthSky = {
    track,
    sendToFunnel
  };

})();