window.NorthSkyAutopilot = (() => {

  const API = "https://your-api.com";

  /* ===============================
     LEAD CAPTURE
  =============================== */

  async function captureLead(email, meta = {}) {

    const payload = {
      email,
      user_id: localStorage.getItem("ns_user_id"),
      session_id: localStorage.getItem("ns_session_id"),
      score: localStorage.getItem("ns_score"),
      url: location.href,
      meta,
      time: new Date().toISOString()
    };

    await fetch(`${API}/lead`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    NorthSkyOS?.track("lead", { email });

    return payload;
  }

  /* ===============================
     CHECKOUT TRACKING
  =============================== */

  function trackCheckoutClick(product = "skymaster_x1") {
    NorthSkyOS?.track("stripe_click", { product });

    fetch(`${API}/checkout-click`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        product,
        user_id: localStorage.getItem("ns_user_id"),
        session_id: localStorage.getItem("ns_session_id"),
        score: localStorage.getItem("ns_score"),
        url: location.href
      })
    });
  }

  /* ===============================
     ABANDONMENT DETECTION
  =============================== */

  let startTime = Date.now();

  function initAbandonTracking() {
    window.addEventListener("beforeunload", () => {

      const timeSpent = Math.round((Date.now() - startTime) / 1000);

      fetch(`${API}/abandon`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          user_id: localStorage.getItem("ns_user_id"),
          session_id: localStorage.getItem("ns_session_id"),
          timeSpent,
          score: localStorage.getItem("ns_score"),
          url: location.href
        })
      });
    });
  }

  /* ===============================
     AUTO HOT LEAD ROUTER
  =============================== */

  function checkHotRoute() {

    const score = Number(localStorage.getItem("ns_score") || 0);

    if (score >= 15) {
      fetch(`${API}/hot-lead`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          user_id: localStorage.getItem("ns_user_id"),
          session_id: localStorage.getItem("ns_session_id"),
          score,
          url: location.href
        })
      });

      // optional auto redirect
      window.location.href = "https://goldylox752.github.io/RoofFlow-AI/";
    }
  }

  /* ===============================
     INIT
  =============================== */

  function init() {
    initAbandonTracking();
    checkHotRoute();
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    captureLead,
    trackCheckoutClick,
    checkHotRoute
  };

})();



window.NorthSkyOS = {
  track(event, data) {
    fetch("https://your-api.com/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        data,
        session: localStorage.getItem("ns_session_id"),
        user: localStorage.getItem("ns_user_id"),
        score: localStorage.getItem("ns_score"),
        url: location.href
      })
    });
  },

  route(score) {
    if (score >= 15) {
      window.location.href = "https://goldylox752.github.io/RoofFlow-AI/";
    }
  }
};




(function () {

  /* =========================
     CONFIG
  ========================= */

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    scoreKey: "ns_score",
    source: "northsky_os",
    crmEndpoint: null,
    debug: true
  };

  /* =========================
     IDENTITY LAYER
  ========================= */

  const id = () => crypto.randomUUID();

  function getOrCreate(key) {
    let val = localStorage.getItem(key);
    if (!val) {
      val = id();
      localStorage.setItem(key, val);
    }
    return val;
  }

  const session = () => getOrCreate(CONFIG.sessionKey);
  const user = () => getOrCreate(CONFIG.userKey);

  /* =========================
     SCORE ENGINE
  ========================= */

  function getScore() {
    return parseInt(localStorage.getItem(CONFIG.scoreKey) || "0");
  }

  function setScore(val) {
    localStorage.setItem(CONFIG.scoreKey, val);
    return val;
  }

  function addScore(val) {
    const updated = getScore() + val;
    return setScore(updated);
  }

  function getStage(score) {
    if (score >= 15) return "HOT";
    if (score >= 6) return "WARM";
    return "COLD";
  }

  /* =========================
     EVENT MAP
  ========================= */

  const SCORE_MAP = {
    page_view: 1,
    click: 3,
    scroll: 2,
    funnel: 10,
    purchase: 25
  };

  /* =========================
     CRM QUEUE (FIX: NO MORE LOST DATA)
  ========================= */

  let queue = [];

  async function flush() {
    if (!CONFIG.crmEndpoint || queue.length === 0) return;

    const batch = [...queue];
    queue = [];

    try {
      await fetch(CONFIG.crmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch)
      });

      if (CONFIG.debug) console.log("CRM FLUSH OK", batch.length);

    } catch (err) {
      console.warn("CRM FAIL → retrying later", err);
      queue.push(...batch); // retry safe
    }
  }

  setInterval(flush, 5000);

  /* =========================
     TRACK ENGINE
  ========================= */

  function track(event, data = {}) {

    const added = SCORE_MAP[event] || 0;
    const newScore = addScore(added);
    const stage = getStage(newScore);

    const payload = {
      event,
      data,
      user_id: user(),
      session_id: session(),
      score: newScore,
      stage,
      url: location.href,
      source: CONFIG.source,
      time: new Date().toISOString()
    };

    queue.push(payload);

    if (CONFIG.debug) console.log("[NS]", payload);

    return payload;
  }

  /* =========================
     SMART FUNNEL ROUTER (THIS IS YOUR MONEY ENGINE)
  ========================= */

  function redirect(url) {

    const s = getScore();
    const stage = getStage(s);

    const full = new URL(url);

    full.searchParams.set("session", session());
    full.searchParams.set("user", user());
    full.searchParams.set("score", s);
    full.searchParams.set("stage", stage);

    track("funnel", { url, stage });

    location.href = full.toString();
  }

  /* =========================
     AUTO TRACKING
  ========================= */

  document.addEventListener("DOMContentLoaded", () => {

    track("page_view");

    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button");
      if (!el) return;

      track("click", {
        text: el.innerText?.trim() || null,
        href: el.href || null
      });
    });

    let maxScroll = 0;

    window.addEventListener("scroll", () => {
      const percent = Math.round(
        ((scrollY + innerHeight) / document.body.scrollHeight) * 100
      );

      if (percent > maxScroll) {
        maxScroll = percent;
        if ([25, 50, 75, 100].includes(percent)) {
          track("scroll", { percent });
        }
      }
    });

  });

  /* =========================
     GLOBAL EXPORT (IMPORTANT FIX)
  ========================= */

  window.NorthSky = {
    track,
    redirect,
    session,
    user,
    getScore,
    getStage
  };

})();