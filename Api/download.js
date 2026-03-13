export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    // Use a working community instance. 
    // You can find more at https://instances.cobalt.best/
    const COBALT_INSTANCE = "https://cobalt-api.v06.io"; 

    try {
        const response = await fetch(COBALT_INSTANCE, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Accept": "application/json" 
            },
            body: JSON.stringify({ 
                url: url, 
                videoQuality: "720",
                downloadMode: "auto"
            })
        });
        
        const data = await response.json();
        
        // Cobalt returns 'stream' or 'redirect' for success
        if (data.url) {
            return res.status(200).json({ downloadUrl: data.url });
        } else {
            // Provide specific error feedback from the instance
            return res.status(400).json({ error: data.text || "This instance is currently blocked by YouTube." });
        }
    } catch (err) {
        return res.status(500).json({ error: "Server error. Please try again in 5 minutes." });
    }
}
