// api/cobalt.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // Note: If this public API is blocked, replace with your self-hosted URL
    const cobaltApi = "https://api.cobalt.tools"; 
    
    const response = await fetch(cobaltApi, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        vQuality: "720",      // Video quality (e.g., 720, 1080, max)
        vCodec: "h264",      // Best compatibility for most devices
        filenameStyle: "pretty" 
      })
    });

    const data = await response.json();
    
    // Cobalt returns 'url', 'redirect', or 'picker'
    if (data.url || data.redirect) {
      return res.status(200).json({ downloadUrl: data.url || data.redirect });
    } else {
      return res.status(400).json({ error: data.text || "Failed to fetch link" });
    }
  } catch (error) {
    return res.status(500).json({ error: "API connection failed" });
  }
}
