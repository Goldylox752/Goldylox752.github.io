(function () {

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    scoreKey: "ns_score",
    source: "northsky_os",
    crmEndpoint: null // connect to Supabase or RoofFlow API later
  };

  const createId = () => crypto.randomUUID();

  const getOrCreate = (key) => {
    let val = localStorage.getItem(key);
    if (!val) {
      val = createId();
      localStorage.setItem(key, val);
    }
    return val;
  };

  const session = () => getOrCreate(CONFIG.sessionKey);
  const user = () => getOrCreate(CONFIG.userKey);

  const getScore = () => parseInt(localStorage.getItem(CONFIG.scoreKey) || "0");

  const addScore = (val) => {
    let s = getScore();
    s += val;
    localStorage.setItem(CONFIG.scoreKey, s);
    return s;
  };

  const stage = (score) => {
    if (score >= 15) return "HOT";
    if (score >= 6) return "WARM";
    return "COLD";
  };

  function track(event, data = {}) {

    const scoreMap = {
      page_view: 1,
      click: 3,
      scroll: 2,
      funnel: 10
    };

    const newScore = addScore(scoreMap[event] || 0);

    const payload = {
      event,
      data,
      user_id: user(),
      session_id: session(),
      score: newScore,
      stage: stage(newScore),
      url: location.href,
      time: new Date().toISOString()
    };

    console.log("[NS EVENT]", payload);

    if (CONFIG.crmEndpoint) {
      fetch(CONFIG.crmEndpoint, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      }).catch(()=>{});
    }
  }

  function redirect(url) {
    track("funnel", { url });
    location.href = url;
  }

  document.addEventListener("DOMContentLoaded", () => {
    track("page_view");

    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button");
      if (!el) return;

      track("click", {
        text: el.innerText?.trim(),
        href: el.href || null
      });
    });
  });

  window.NorthSky = { track, redirect, session, user, getScore };

})();