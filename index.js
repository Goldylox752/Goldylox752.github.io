/* ===============================
   NORTHSKY REVENUE ENGINE CORE
   Tracking + Leads + Attribution
   =============================== */

(function () {

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    sourceTag: "northsky_os",
    batchSize: 10,
    flushInterval: 5000,
    endpoint: null
  };

  let queue = [];
  let start = Date.now();
  let maxScroll = 0;
  let initialized = false;

  /* ===============================
     IDS
  =============================== */

  function id(key){
    let v = localStorage.getItem(key);
    if(!v){
      v = crypto.randomUUID();
      localStorage.setItem(key, v);
    }
    return v;
  }

  const getSession = () => id(CONFIG.sessionKey);
  const getUser = () => id(CONFIG.userKey);

  /* ===============================
     ATTRIBUTION
  =============================== */

  function attr(){
    const p = new URLSearchParams(location.search);
    return {
      utm_source: p.get("utm_source") || "direct",
      utm_campaign: p.get("utm_campaign") || "none",
      utm_medium: p.get("utm_medium") || "organic",
      referrer: document.referrer || "none"
    };
  }

  /* ===============================
     SCORE MODEL
  =============================== */

  function score(e){
    return {
      page_view:1,
      scroll_depth:2,
      click:5,
      funnel_redirect:10,
      time_on_page:2
    }[e] || 0;
  }

  function updateScore(event){
    const add = score(event);
    if(!add) return;

    let s = parseInt(localStorage.getItem("ns_score")||"0");
    s += add;
    localStorage.setItem("ns_score", s);

    if(s >= 15) track("hot_lead", {score:s});
  }

  /* ===============================
     TRACK (CORE)
  =============================== */

  function track(event, data={}){

    const payload = {
      event,
      data,
      session_id: getSession(),
      user_id: getUser(),
      page: location.href,
      timestamp: new Date().toISOString(),
      ...attr()
    };

    queue.push(payload);

    updateScore(event);

    if(queue.length >= CONFIG.batchSize) flush();
  }

  async function flush(){
    if(!queue.length) return;

    const batch = [...queue];
    queue = [];

    if(!CONFIG.endpoint) return;

    try{
      await fetch(CONFIG.endpoint,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(batch)
      });
    }catch(e){}
  }

  setInterval(flush, CONFIG.flushInterval);

  /* ===============================
     FUNNEL
  =============================== */

  function redirect(url){

    const u = new URL(url);
    const a = attr();

    u.searchParams.set("session_id", getSession());
    u.searchParams.set("user_id", getUser());
    u.searchParams.set("from", CONFIG.sourceTag);

    Object.entries(a).forEach(([k,v])=>u.searchParams.set(k,v));

    track("funnel_redirect",{destination:url});

    location.href = u.toString();
  }

  /* ===============================
     INIT (FIXED DUPLICATION BUG)
  =============================== */

  function init(){

    if(initialized) return;
    initialized = true;

    track("page_view");

    document.addEventListener("click",(e)=>{
      const el = e.target.closest(".btn,a");
      if(!el) return;

      track("click",{
        text: el.innerText?.trim(),
        href: el.href || null
      });
    });

    window.addEventListener("scroll",()=>{
      const p = Math.round((scrollY+innerHeight)/document.body.scrollHeight*100);

      if(p > maxScroll){
        maxScroll = p;

        if([25,50,75,100].includes(p)){
          track("scroll_depth",{percent:p});
        }
      }
    });

    window.addEventListener("beforeunload",()=>{
      track("time_on_page",{seconds:Math.round((Date.now()-start)/1000)});
      flush();
    });
  }

  document.addEventListener("DOMContentLoaded",init);

  window.NorthSky = {
    track,
    redirectToFunnel: redirect,
    flush,
    getSession,
    getUser
  };

})();