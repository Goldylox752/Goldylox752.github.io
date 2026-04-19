app.post("/lead", async (req, res) => {
  try {
    const {
      name,
      contact,
      postalCode,
      service = "unknown",
      source = "direct",
      pageUrl = null
    } = req.body;

    /* =========================
       VALIDATION
    ========================= */

    if (!contact || typeof contact !== "string" || contact.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "Invalid contact information"
      });
    }

    const cleanContact = contact.trim();

    /* =========================
       DUPLICATE CHECK
    ========================= */

    const { data: existingLead, error: checkError } = await supabase
      .from("leads")
      .select("id, contact")
      .eq("contact", cleanContact)
      .maybeSingle();

    if (checkError) {
      console.error("Duplicate check failed:", checkError);

      return res.status(500).json({
        success: false,
        error: checkError.message
      });
    }

    if (existingLead) {
      return res.status(200).json({
        success: true,
        message: "Lead already exists",
        leadId: existingLead.id
      });
    }

    /* =========================
       CREATE LEAD OBJECT
    ========================= */

    const newLead = {
      name: name || null,
      contact: cleanContact,
      postal_code: postalCode || null,
      service,
      source,
      page_url: pageUrl,
      status: "new",
      score: 0,
      created_at: new Date().toISOString()
    };

    /* =========================
       INSERT INTO SUPABASE
    ========================= */

    const { data, error } = await supabase
      .from("leads")
      .insert(newLead)
      .select()
      .single();

    /* =========================
       ERROR HANDLING (IMPORTANT)
    ========================= */

    if (error) {
      console.error("Supabase insert error:", error);

      return res.status(500).json({
        success: false,
        error: error.message,
        details: error
      });
    }

    /* =========================
       SUCCESS RESPONSE
    ========================= */

    return res.status(201).json({
      success: true,
      leadId: data.id,
      message: "Lead captured successfully"
    });

  } catch (err) {
    console.error("Lead API crash:", err);

    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});