// =======================
// BASIC UI HELPERS
// =======================

function showMessage(msg, type = "info") {
  const el = document.createElement("div");
  el.textContent = msg;

  el.style.position = "fixed";
  el.style.top = "20px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.padding = "12px 18px";
  el.style.borderRadius = "8px";
  el.style.zIndex = "9999";
  el.style.color = "#fff";
  el.style.fontSize = "14px";

  if (type === "success") el.style.background = "#22c55e";
  else if (type === "error") el.style.background = "#ef4444";
  else el.style.background = "#3b82f6";

  document.body.appendChild(el);

  setTimeout(() => el.remove(), 3000);
}

// =======================
// STRIPE CHECKOUT
// =======================

async function startCheckout() {
  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      showMessage("Checkout failed", "error");
    }
  } catch (err) {
    showMessage("Server error", "error");
    console.error(err);
  }
}

// =======================
// SESSION VERIFY (UNLOCK LOGIC)
// =======================

async function verifySession(sessionId) {
  try {
    const res = await fetch("/api/verify-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ session_id: sessionId })
    });

    const data = await res.json();

    if (data.valid) {
      showMessage("Access unlocked", "success");
      localStorage.setItem("access", "true");
      unlockUI();
    } else {
      showMessage("Invalid session", "error");
    }
  } catch (err) {
    console.error(err);
    showMessage("Verification failed", "error");
  }
}

// =======================
// SIMPLE ACCESS CONTROL
// =======================

function unlockUI() {
  const locked = document.querySelectorAll(".locked");
  locked.forEach(el => {
    el.style.display = "block";
  });
}

function checkAccess() {
  const access = localStorage.getItem("access");

  if (access === "true") {
    unlockUI();
  } else {
    const locked = document.querySelectorAll(".locked");
    locked.forEach(el => {
      el.style.display = "none";
    });
  }
}

// =======================
// INIT ON LOAD
// =======================

document.addEventListener("DOMContentLoaded", () => {
  checkAccess();

  // Auto-detect Stripe return
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get("session_id");

  if (sessionId) {
    verifySession(sessionId);

    // clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // bind checkout buttons
  document.querySelectorAll("[data-checkout]").forEach(btn => {
    btn.addEventListener("click", startCheckout);
  });
});