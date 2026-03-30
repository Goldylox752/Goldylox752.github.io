// api/download.js
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    // We use a public Cobalt instance to fetch the direct download link
    const response = await fetch("https://api.cobalt.tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ url: url })
    });

    const data = await response.json();
    
    if (data.status === "stream" || data.status === "redirect") {
      return res.status(200).json({ downloadUrl: data.url });
    } else {
      return res.status(500).json({ error: "Could not process this link." });
    }
  } catch (error) {
    return res.status(500).json({ error: "Server error: " + error.message });
  }
}
import { supabase } from './supabase.js'

// Insert data
export async function saveSim(data) {
  const { data: result, error } = await supabase
    .from('sims')
    .insert([data])

  if (error) {
    console.error(error)
    return null
  }

  return result
}

