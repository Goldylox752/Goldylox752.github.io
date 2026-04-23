<script>
(async () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  if (!sessionId) {
    console.log("No session_id found");
    return;
  }

  try {
    const res = await fetch("/api/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId })
    });

    const data = await res.json();

    if (data.valid) {
      localStorage.setItem("access", "true");
      localStorage.setItem("plan", data.plan);

      document.body.innerHTML = `
        <h1>🎉 Access Unlocked</h1>
        <p>Your plan: ${data.plan}</p>
        <a href="/app.html">Enter App</a>
      `;
    } else {
      document.body.innerHTML = `<h1>❌ Payment not verified</h1>`;
    }

  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<h1>Error verifying payment</h1>`;
  }
})();
</script>