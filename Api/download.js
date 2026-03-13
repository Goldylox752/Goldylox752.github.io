// api/download.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Official Cobalt API endpoint
    const cobaltApi = "https://api.cobalt.tools/api/json";
    
    const response = await fetch(cobaltApi, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        videoQuality: "720",      // Options: 144 to 2160 or "max"
        youtubeVideoCodec: "h264", // Best for device compatibility
        downloadMode: "auto"       // Can be "audio" for MP3 only
      })
    });

    const data = await response.json();
    
    // Cobalt returns a 'url' for standard streams or 'redirect' for direct links
    if (data.url || data.redirect) {
      return res.status(200).json({ downloadUrl: data.url || data.redirect });
    } else {
      return res.status(400).json({ error: data.text || "Failed to get link" });
    }
  } catch (error) {
    return res.status(500).json({ error: "Server Error" });
  }
}
