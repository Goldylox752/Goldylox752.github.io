(function () {

  /* ===============================
     CONFIG
  =============================== */

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    scoreKey: "ns_score",
    sourceTag: "northsky_os",

    endpoint: null,

    hotLeadThreshold: 15,
    warmLeadThreshold: 6,

    batchSize: 10,
    flushInterval: 5000
  };

  /* ===============================
     STATE
  =============================== */

  let queue = [];
  let startTime = Date.now();
  let maxScroll = 0;
  let initialized = false;
  let hotLeadTriggered = false;

  /* ===============================
     SAFE STORAGE HELPERS
  =============================== */

  const createId = () => crypto.randomUUID();

  function getOrCreate(key) {
    try {
      let val = localStorage.getItem(key);

      if (!val) {
        val = createId();
        localStorage.setItem(key, val);
      }

      return val;
    } catch (e) {
      console.warn("Storage error:", e);
      return null;
    }
  }

  const getSession = () => getOrCreate(CONFIG.sessionKey);
  const getUser = () => getOrCreate(CONFIG.userKey);

  /* ===============================
     ATTRIBUTION
  =============================== */

  function getAttribution() {
    const p = new URLSearchParams(window.location.search);

    return {
      utm_source: p.get("utm_source") || "direct",
      utm_campaign: p.get("utm_campaign") || "none",
      utm_medium: p.get("utm_medium") || "organic",
      referrer: document.referrer || "none"
    };
  }

  /* ===============================
     SCORE ENGINE (SAFE)
  =============================== */

  const SCORE_MAP = {
    page_view: 1,
    click: 5,
    link_click: 3,
    scroll_depth: 2,
    funnel_redirect: 10,
    time_on_page: 2
  };

  function getScore() {
    return parseInt(localStorage.getItem(CONFIG.scoreKey) || "0");
  }

  function setScore(value) {
    localStorage.setItem(CONFIG.scoreKey, String(value));
  }

  function addScore(event) {
    const add = SCORE_MAP[event] || 0;
    if (!add) return getScore();

    const updated = getScore() + add;
    setScore(updated);

    return updated;
  }

  function getLeadStage(score) {
    if (score >= CONFIG.hotLeadThreshold) return "HOT";
    if (score >= CONFIG.warmLeadThreshold) return "WARM";
    return "COLD";
  }

  /* ===============================
     CRM SYNC (SAFE OPTIONAL)
  =============================== */

  async function syncCRM(event, data = {}) {

    if (!CONFIG.endpoint) return;

    const payload = {
      event,
      data,

      user_id: getUser(),
      session_id: getSession(),

      score: getScore(),
      stage: getLeadStage(getScore()),

      page: window.location.href,
      timestamp: new Date().toISOString(),

      ...getAttribution()
    };

    try {
      await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("CRM sync failed:", e);
    }
  }

  /* ===============================
     CORE TRACK FUNCTION
  =============================== */

  function track(event, data = {}) {

    const scoreBefore = getScore();
    const scoreAfter = addScore(event);

    const payload = {
      event,
      data,

      session_id: getSession(),
      user_id: getUser(),

      score: scoreAfter,
      stage: getLeadStage(scoreAfter),

      page: window.location.href,
      timestamp: new Date().toISOString(),

      ...getAttribution()
    };

    console.log("[NS EVENT]", payload);

    queue.push(payload);

    syncCRM(event, data);

    if (queue.length >= CONFIG.batchSize) flush();

    /* ===============================
       HOT LEAD TRIGGER (FIXED LOOP SAFE)
    =============================== */

    if (
      scoreAfter >= CONFIG.hotLeadThreshold &&
      !hotLeadTriggered
    ) {
      hotLeadTriggered = true;
      track("hot_lead", { score: scoreAfter });
    }
  }

  /* ===============================
     FLUSH BATCH
  =============================== */

  async function flush() {

    if (!queue.length || !CONFIG.endpoint) return;

    const batch = [...queue];
    queue = [];

    try {
      await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch)
      });
    } catch (e) {
      console.warn("Flush failed:", e);
    }
  }

  setInterval(flush, CONFIG.flushInterval);

  /* ===============================
     FUNNEL REDIRECT
  =============================== */

  function redirectToFunnel(url) {

    const full = new URL(url);
    const attr = getAttribution();

    full.searchParams.set("session_id", getSession());
    full.searchParams.set("user_id", getUser());
    full.searchParams.set("from", CONFIG.sourceTag);

    Object.entries(attr).forEach(([k, v]) => {
      full.searchParams.set(k, v);
    });

    track("funnel_redirect", { destination: url });

    window.location.href = full.toString();
  }

  /* ===============================
     INIT SYSTEM (FIXED ORDER)
  =============================== */

  function init() {

    if (initialized) return;
    initialized = true;

    /* ensure baseline values exist */
    getSession();
    getUser();

    if (!localStorage.getItem(CONFIG.scoreKey)) {
      setScore(0);
    }

    track("page_view");

    /* unified click tracking */
    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, .btn");
      if (!el) return;

      track("click", {
        text: el.innerText?.trim() || null,
        href: el.href || null
      });
    });

    /* scroll tracking */
    window.addEventListener("scroll", () => {
      const percent = Math.round(
        ((scrollY + innerHeight) / document.body.scrollHeight) * 100
      );

      if (percent > maxScroll) {
        maxScroll = percent;

        if ([25, 50, 75, 100].includes(percent)) {
          track("scroll_depth", { percent });
        }
      }
    });

    /* time tracking */
    window.addEventListener("beforeunload", () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      track("time_on_page", { seconds: duration });
      flush();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  /* ===============================
     PUBLIC API
  =============================== */

  window.NorthSky = {
    track,
    flush,
    redirectToFunnel,
    getSession,
    getUser,
    getScore,
    getLeadStage
  };

})();