export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    // Active community instances as of March 2026
    // Always check https://instances.cobalt.best/ for 100% score servers
    const instances = [
        "https://cobalt.meowing.de", 
        "https://cobalt.canine.tools",
        "https://cobalt-api.v06.io"
    ];

    for (let instance of instances) {
        try {
            const response = await fetch(instance, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ 
                    url: url, 
                    videoQuality: "720",
                    downloadMode: "auto"
                })
            });
            
            const data = await response.json();
            if (data.url) return res.status(200).json({ downloadUrl: data.url });
            
        } catch (err) {
            console.warn(`Instance ${instance} failed, trying next...`);
            continue; 
        }
    }

    return res.status(500).json({ error: "YouTube is blocking all current nodes. Please try again later." });
}
