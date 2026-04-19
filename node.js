app.post("/api/event", async (req, res) => {
  const event = req.body;

  const scoreMap = {
    page_view: 1,
    click: 2,
    funnel_click: 5,
    checkout_click: 10,
    lead: 8
  };

  const score = scoreMap[event.event] || 0;

  const stage =
    event.score >= 15 ? "HOT" :
    event.score >= 6 ? "WARM" :
    "COLD";

  const enriched = {
    ...event,
    score,
    stage,
    created_at: new Date().toISOString()
  };

  await supabase.from("events").insert([enriched]);

  // AUTO ROUTING LOGIC
  if (stage === "HOT") {
    await supabase.from("hot_leads").insert([enriched]);

    console.log("🔥 HOT LEAD ROUTED:", event.user_id);
  }

  if (event.event === "checkout_click") {
    await supabase.from("checkout_events").insert([enriched]);
  }

  if (event.event === "lead") {
    await supabase.from("leads").insert([enriched]);
  }

  res.json({ ok: true, stage });
});