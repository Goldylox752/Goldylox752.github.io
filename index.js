/* ===============================
   NORTHSKY SYSTEMS OS
   Funnel Tracking + Session Engine
   =============================== */

(function () {

  /* ===============================
     CONFIG
  =============================== */

  const CONFIG = {
    sessionKey: "ns_session_id",
    userKey: "ns_user_id",
    sourceTag: "northsky_os"
  };

  /* ===============================
     SESSION HELPERS
  =============================== */

  function createId() {
    return crypto.randomUUID();
  }

  function getStorageKey(key) {
    let value = localStorage.getItem(key);

    if (!value) {
      value = createId();
      localStorage.setItem(key, value);
    }

    return value;
  }

  function getSession() {
    return getStorageKey(CONFIG.sessionKey);
  }

  function getUser() {
    return getStorageKey(CONFIG.userKey);
  }

  /* ===============================
     TRAFFIC ATTRIBUTION
  =============================== */

  function getAttribution() {
    const params = new URLSearchParams(window.location.search);

    return {
      utm_source: params.get("utm_source") || "direct",
      utm_campaign: params.get("utm_campaign") || "none",
      utm_medium: params.get("utm_medium") || "organic",
      referrer: document.referrer || "none"
    };
  }

  /* ===============================
     EVENT TRACKER (CORE ENGINE)
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

    console.log("[NS TRACK]", event);

    // Future: backend ingestion
    // sendEvent(event);
  }

  /* ===============================
     FUNNEL REDIRECT ENGINE
  =============================== */

  function redirectToFunnel(destinationUrl) {
    const url = new URL(destinationUrl);

    const attribution = getAttribution();

    url.searchParams.set("session_id", getSession());
    url.searchParams.set("user_id", getUser());
    url.searchParams.set("from", CONFIG.sourceTag);

    Object.entries(attribution).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    track("funnel_redirect", { destination: destinationUrl });

    window.location.href = url.toString();
  }

  /* ===============================
     AUTO EVENT BINDING
  =============================== */

  function initAutoTracking() {

    track("page_view");

    // Button clicks
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        track("button_click", {
          text: btn.innerText.trim()
        });
      });
    });

    // Link clicks
    document.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        track("link_click", {
          href: link.href
        });
      });
    });
  }

  /* ===============================
     OPTIONAL ADVANCED EVENTS
  =============================== */

  function trackEngagement() {
    let startTime = Date.now();
    let maxScroll = 0;

    // Time on page
    window.addEventListener("beforeunload", () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
      track("time_on_page", { seconds: duration });
    });

    // Scroll depth
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
     INIT SYSTEM
  =============================== */

  document.addEventListener("DOMContentLoaded", () => {
    initAutoTracking();
    trackEngagement();
  });

  /* ===============================
     PUBLIC API
  =============================== */

  window.NorthSky = {
    track,
    redirectToFunnel,
    getSession,
    getUser
  };

})();