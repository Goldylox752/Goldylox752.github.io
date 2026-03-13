// Replace the URL below with a working one from cobalt.directory if it fails
const COBALT_INSTANCE = "https://cobalt-api.v06.io"; // Example community instance

export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    try {
        const response = await fetch(COBALT_INSTANCE, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Accept": "application/json" 
            },
            body: JSON.stringify({ 
                url: url, 
                videoQuality: "720" 
            })
        });
        
        const data = await response.json();
        
        if (data.url) {
            return res.status(200).json({ downloadUrl: data.url });
        } else {
            // Cobalt returns specific error text if a platform is blocked
            return res.status(400).json({ error: data.text || "This platform is currently blocked on this instance." });
        }
    } catch (err) {
        return res.status(500).json({ error: "Server error. Try a different Cobalt instance." });
    }
}
