import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   SUPABASE
========================= */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================
   CREATE LEAD (CORE FUNNEL ENTRY)
========================= */

app.post("/lead", async (req, res) => {
  try {
    const { name, contact, postalCode, service } = req.body;

    if (!contact) {
      return res.status(400).json({ error: "Missing contact info" });
    }

    const leadId = uuidv4();

    const { error } = await supabase.from("leads").insert([
      {
        id: leadId,
        name,
        contact,
        postal_code: postalCode,
        service,
        status: "new",
        created_at: new Date().toISOString()
      }
    ]);

    if (error) throw error;

    return res.json({
      success: true,
      leadId,
      message: "Lead captured successfully"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Lead creation failed"
    });
  }
});

/* =========================
   GET LEADS (CRM VIEW)
========================= */

app.get("/leads", async (req, res) => {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, leads: data });
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    system: "NorthSky Lead Engine v1"
  });
});

/* =========================
   START
========================= */

app.listen(3000, () => {
  console.log("🚀 Lead system running on port 3000");
});