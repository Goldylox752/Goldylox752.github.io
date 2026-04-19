(function () {

  /* ===============================
     CONFIG
  =============================== */

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    sourceTag: "northsky_os",

    // optional backend (Supabase / webhook)
    endpoint: null,

    // lead scoring thresholds
    hotLeadScore: 15
  };

  /* ===============================
     STATE
  =============================== */

  let queue = [];
  let startTime = Date.now();
  let maxScroll = 0;
  let initialized = false;

  /* ===============================
     IDENTITY SYSTEM
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

  const getSession = () => getOrCreate(CONFIG.sessionKey);
  const getUser = () => getOrCreate(CONFIG.userKey);

  /* ===============================
     ATTRIBUTION SYSTEM
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

  function score(event) {
    const map = {
      page_view: 1,
      scroll_depth: 2,
      click: 5,
      link_click: 3,
      funnel_redirect: 10,
      form_start: 8,
      form_submit: 15
    };

    return map[event] || 0;
  }

  function updateLeadScore(event) {
    const add = score(event);
    if (!add) return;

    let current = parseInt(localStorage.getItem("ns_score") || "0");
    current += add;

    localStorage.setItem("ns_score", current);

    if (current >= CONFIG.hotLeadScore) {
      track("hot_lead", { score: current });
    }
  }

  /* ===============================
     CRM INTEGRATION HOOK (ROOFFLOW)
  =============================== */

  async function syncToCRM(event, data = {}) {

    const payload = {
      user_id: getUser(),
      session_id: getSession(),

      event,
      data,

      score: parseInt(localStorage.getItem("ns_score") || "0"),

      last_action: event,
      last_seen: new Date().toISOString(),

      ...getAttribution()
    };

    // OPTIONAL: send directly to Supabase or RoofFlow endpoint
    if (CONFIG.endpoint) {
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
  }

  /* ===============================
     CORE TRACK FUNCTION
  =============================== */

  function track(event, data = {}) {

    const payload = {
      event,
      data,
      session_id: getSession(),
      user_id: getUser(),
      page: window.location.href,
      timestamp: new Date().toISOString(),
      ...getAttribution()
    };

    console.log("[NS EVENT]", payload);

    queue.push(payload);

    updateLeadScore(event);
    syncToCRM(event, data);

    if (queue.length >= 10) flush();
  }

  /* ===============================
     FLUSH EVENTS
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

  setInterval(flush, 5000);

  /* ===============================
     FUNNEL REDIRECT (ROOFFLOW CORE)
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
     AUTO TRACKING INIT
  =============================== */

  function init() {

    if (initialized) return;
    initialized = true;

    track("page_view");

    // unified click tracking (fixes duplication issues)
    document.addEventListener("click", (e) => {
      const el = e.target.closest(".btn, a");
      if (!el) return;

      track("click", {
        text: el.innerText?.trim() || null,
        href: el.href || null
      });
    });

    // scroll depth tracking
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

    // session time tracking
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
    redirectToFunnel,
    flush,
    getSession,
    getUser
  };

})();