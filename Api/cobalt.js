// api/cobalt.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, mode = "auto" } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // Note: If api.cobalt.tools is blocked, you must use a self-hosted instance URL here.
    const cobaltApi = "https://api.cobalt.tools"; 
    
    const response = await fetch(cobaltApi, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: url,
        downloadMode: mode,      // "auto", "audio", or "mute"
        videoQuality: "1080",    // Options: 144, 360, 480, 720, 1080, 1440, 2160, max
        youtubeVideoCodec: "h264", 
        filenameStyle: "pretty" 
      })
    });

    const data = await response.json();
    
    // Cobalt returns 'url' for standard streams or 'redirect' for direct links
    if (data.url || data.redirect) {
      return res.status(200).json({ downloadUrl: data.url || data.redirect });
    } else {
      return res.status(400).json({ error: data.text || "Cobalt could not process this link." });
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed to connect to Cobalt API." });
  }
}
