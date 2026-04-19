(function () {

  /* =========================
     CONFIG
  ========================= */

  const CONFIG = {
    endpoint: "https://your-api.com/event",
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    scoreKey: "ns_score",
    hotThreshold: 15,
    debug: false,
    source: location.hostname
  };

  /* =========================
     IDENTITY LAYER
  ========================= */

  const uid = () => crypto.randomUUID();

  function getOrCreate(key) {
    let v = localStorage.getItem(key);
    if (!v) {
      v = uid();
      localStorage.setItem(key, v);
    }
    return v;
  }

  const session = getOrCreate(CONFIG.sessionKey);
  const user = getOrCreate(CONFIG.userKey);

  /* =========================
     SCORE ENGINE
  ========================= */

  const SCORE_MAP = {
    page_view: 1,
    click: 2,
    scroll: 1,
    funnel: 8,
    checkout_click: 12,
    lead: 10,
    purchase: 25
  };

  function getScore() {
    return Number(localStorage.getItem(CONFIG.scoreKey) || 0);
  }

  function setScore(v) {
    localStorage.setItem(CONFIG.scoreKey, String(v));
  }

  function addScore(event) {
    const next = getScore() + (SCORE_MAP[event] || 0);
    setScore(next);
    return next;
  }

  function getStage(score) {
    if (score >= CONFIG.hotThreshold) return "HOT";
    if (score >= 6) return "WARM";
    return "COLD";
  }

  /* =========================
     EVENT DISPATCH
  ========================= */

  async function send(payload) {
    try {
      await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
    } catch (e) {}
  }

  /* =========================
     CORE TRACK FUNCTION
  ========================= */

  function track(event, data = {}) {

    const score = addScore(event);
    const stage = getStage(score);

    const payload = {
      event,
      data,
      user_id: user,
      session_id: session,
      score,
      stage,
      source: CONFIG.source,
      url: location.href,
      time: new Date().toISOString()
    };

    if (CONFIG.debug) console.log("[NS]", payload);

    send(payload);

    /* HOT LEAD AUTO ROUTE */
    if (score >= CONFIG.hotThreshold) {
      send({
        event: "hot_lead",
        user_id: user,
        session_id: session,
        score,
        stage,
        url: location.href
      });

      window.dispatchEvent(new CustomEvent("HOT_LEAD", { detail: payload }));
    }

    return payload;
  }

  /* =========================
     FUNNEL ROUTER
  ========================= */

  function redirect(url) {

    const score = getScore();
    const stage = getStage(score);

    const u = new URL(url);
    u.searchParams.set("user", user);
    u.searchParams.set("session", session);
    u.searchParams.set("score", score);
    u.searchParams.set("stage", stage);

    track("funnel", { url });

    location.href = u.toString();
  }

  /* =========================
     AUTO TRACKING
  ========================= */

  function init() {

    track("page_view");

    /* clicks */
    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button");
      if (!el) return;

      track("click", {
        text: el.innerText?.trim() || null,
        href: el.href || null
      });
    });

    /* scroll depth */
    let last = 0;

    window.addEventListener("scroll", () => {
      const pct = Math.round(
        ((scrollY + innerHeight) / document.body.scrollHeight) * 100
      );

      if (pct > last && [25, 50, 75, 100].includes(pct)) {
        last = pct;
        track("scroll", { pct });
      }
    });

    /* abandonment */
    window.addEventListener("beforeunload", () => {
      send({
        event: "abandon",
        user_id: user,
        session_id: session,
        score: getScore(),
        url: location.href,
        time_on_page: Math.round(performance.now() / 1000)
      });
    });

    /* hot lead listener */
    window.addEventListener("HOT_LEAD", () => {
      if (CONFIG.debug) console.log("🔥 HOT LEAD TRIGGERED");
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  /* =========================
     GLOBAL EXPORT
  ========================= */

  window.NorthSkyOS = {
    track,
    redirect,
    getScore,
    getStage,
    session: () => session,
    user: () => user
  };

})();