window.NorthSky = (() => {

  const API = "https://your-api.com";

  const CONFIG = {
    hot: 15,
    warm: 6,
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    scoreKey: "ns_score",
  };

  /* =========================
     IDENTITY LAYER (UNIVERSAL)
  ========================= */

  const id = () => crypto.randomUUID();

  function get(key){
    let v = localStorage.getItem(key);
    if(!v){
      v = id();
      localStorage.setItem(key, v);
    }
    return v;
  }

  const session = get(CONFIG.sessionKey);
  const user = get(CONFIG.userKey);

  /* =========================
     SCORE ENGINE
  ========================= */

  const MAP = {
    page_view: 1,
    click: 2,
    scroll_50: 2,
    scroll_100: 3,
    stripe_click: 10,
    funnel_click: 8
  };

  function score(){
    return Number(localStorage.getItem(CONFIG.scoreKey) || 0);
  }

  function setScore(v){
    localStorage.setItem(CONFIG.scoreKey, v);
    return v;
  }

  function add(event){
    const next = score() + (MAP[event] || 0);
    setScore(next);
    return next;
  }

  function stage(s){
    if(s >= CONFIG.hot) return "HOT";
    if(s >= CONFIG.warm) return "WARM";
    return "COLD";
  }

  /* =========================
     EVENT PIPE (THE MONEY PIPE)
  ========================= */

  function send(event, data = {}) {

    const s = score();
    const payload = {
      event,
      data,
      user,
      session,
      score: s,
      stage: stage(s),
      url: location.href,
      ts: Date.now()
    };

    // fire-and-forget event stream
    fetch(`${API}/event`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    }).catch(()=>{});
  }

  /* =========================
     TRACK FUNCTION (CORE HOOK)
  ========================= */

  function track(event, data){
    const newScore = add(event);

    const payload = {
      event,
      data,
      user,
      session,
      score: newScore,
      stage: stage(newScore)
    };

    send(event, data);

    // 🚨 AUTOPILOT DECISION ENGINE
    if(stage(newScore) === "HOT"){
      triggerHotLoop(payload);
    }

    return payload;
  }

  /* =========================
     HOT LEAD LOOP (AUTOMATION TRIGGER)
  ========================= */

  function triggerHotLoop(data){

    send("hot_lead", data);

    // 1. CRM push
    fetch(`${API}/hot-lead`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify(data)
    }).catch(()=>{});

    // 2. optional redirect to conversion
    setTimeout(() => {
      window.location.href =
        "https://goldylox752.github.io/RoofFlow-AI/";
    }, 800);
  }

  /* =========================
     FUNNEL ROUTER (SMART REDIRECT)
  ========================= */

  function go(url){
    track("funnel_click", {url});
    window.location.href = url;
  }

  /* =========================
     AUTO TRACKING (EVERY PAGE)
  ========================= */

  function init(){

    track("page_view");

    document.addEventListener("click", (e) => {
      const el = e.target.closest("a,button");
      if(!el) return;

      track("click", {
        text: el.innerText?.trim(),
        href: el.href || null
      });
    });

    let max = 0;

    window.addEventListener("scroll", () => {
      const pct = Math.round((scrollY + innerHeight) / document.body.scrollHeight * 100);

      if(pct > max){
        max = pct;

        if(pct >= 50) track("scroll_50");
        if(pct >= 100) track("scroll_100");
      }
    });

  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    track,
    go,
    score,
    stage: () => stage(score()),
    session: () => session,
    user: () => user
  };

})();