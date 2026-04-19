/* ===============================
   NORTHSKY GROWTH SYSTEM CORE
   Tracking + Attribution + Lead Engine
   =============================== */

(function () {

  /* ===============================
     CONFIG
  =============================== */

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    sourceTag: "northsky_os",

    // batching (performance upgrade)
    batchSize: 10,
    flushInterval: 5000,

    // optional backend (Supabase / API)
    endpoint: null // "https://your-api.com/events"
  };

  /* ===============================
     STATE
  =============================== */

  let eventQueue = [];
  let startTime = Date.now();
  let maxScroll = 0;

  /* ===============================
     ID SYSTEM
  =============================== */

  function createId() {
    return crypto.randomUUID();
  }

  function getOrCreate(key) {
    let value = localStorage.getItem(key);

    if (!value) {
      value = createId();
      localStorage.setItem(key, value);
    }

    return value;
  }

  function getSession() {
    return getOrCreate(CONFIG.sessionKey);
  }

  function getUser() {
    return getOrCreate(CONFIG.userKey);
  }

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
     LEAD SCORING ENGINE
  =============================== */

  function scoreEvent(eventName) {
    const map = {
      page_view: 1,
      scroll_depth: 2,
      button_click: 5,
      link_click: 3,
      time_on_page: 2,
      funnel_redirect: 10
    };

    return map[eventName] || 0;
  }

  function updateLeadScore(eventName) {
    const score = scoreEvent(eventName);
    if (score <= 0) return;

    let current = parseInt(localStorage.getItem("ns_score") || "0");
    current += score;

    localStorage.setItem("ns_score", current);

    if (current >= 15) {
      track("hot_lead", { score: current });
    }
  }

  /* ===============================
     EVENT ENGINE (CORE)
  =============================== */

  function track(eventName, data = {}) {

    const event = {
      event: eventName,
      data,
      session_id: getSession(),
      user_id: getUser(),
      page: window.location.href,
      timestamp: new Date().toISOString(),
      ...getAttribution()
    };

    console.log("[NS EVENT]", event);

    // queue event (batching)
    eventQueue.push(event);

    // lead scoring
    updateLeadScore(eventName);

    // flush if needed
    if (eventQueue.length >= CONFIG.batchSize) {
      flushEvents();
    }
  }

  /* ===============================
     SEND EVENTS (BATCHED)
  =============================== */

  async function flushEvents() {
    if (eventQueue.length === 0) return;

    const batch = [...eventQueue];
    eventQueue = [];

    console.log("[NS FLUSH]", batch);

    if (!CONFIG.endpoint) return;

    try {
      await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch)
      });
    } catch (err) {
      console.warn("Flush failed:", err);
    }
  }

  setInterval(flushEvents, CONFIG.flushInterval);

  /* ===============================
     FUNNEL REDIRECT ENGINE
  =============================== */

  function redirectToFunnel(url) {

    const fullUrl = new URL(url);
    const attr = getAttribution();

    fullUrl.searchParams.set("session_id", getSession());
    fullUrl.searchParams.set("user_id", getUser());
    fullUrl.searchParams.set("from", CONFIG.sourceTag);

    Object.entries(attr).forEach(([k, v]) => {
      fullUrl.searchParams.set(k, v);
    });

    track("funnel_redirect", { destination: url });

    window.location.href = fullUrl.toString();
  }

  /* ===============================
     AUTO TRACKING
  =============================== */

  function initTracking() {

    track("page_view");

    // clicks
    document.querySelectorAll(".btn, a").forEach(el => {
      el.addEventListener("click", () => {
        track("click", {
          text: el.innerText?.trim(),
          href: el.href || null
        });
      });
    });
  }

  /* ===============================
     ENGAGEMENT TRACKING
  =============================== */

  function initEngagement() {

    window.addEventListener("beforeunload", () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      track("time_on_page", { seconds: duration });

      flushEvents();
    });

    window.addEventListener("scroll", () => {
      const scrollPercent = Math.round(
        ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
      );

      if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;

        if ([25, 50, 75, 100].includes(scrollPercent)) {
          track("scroll_depth", { percent: scrollPercent });
        }
      }
    });
  }

  /* ===============================
     INIT
  =============================== */

  document.addEventListener("DOMContentLoaded", () => {
    initTracking();
    initEngagement();
  });

  /* ===============================
     PUBLIC API
  =============================== */

  window.NorthSky = {
    track,
    redirectToFunnel,
    flushEvents,
    getSession,
    getUser
  };

})();