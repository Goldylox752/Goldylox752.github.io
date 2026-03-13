export default async function handler(req, res) {
    const { url } = req.query;
    // Replace with your current ngrok URL
    const PRIVATE_NODE = "https://your-ngrok-id.ngrok-free.app"; 

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(PRIVATE_NODE, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url, videoQuality: "720" })
        });

        const data = await response.json();
        clearTimeout(timeoutId);

        if (data.url) {
            return res.status(200).json({ downloadUrl: data.url });
        } else {
            return res.status(429).json({ error: "Node is busy. Try a shorter video." });
        }
    } catch (err) {
        return res.status(500).json({ error: "Home server connection lost." });
    }
}body: JSON.stringify({ 
    url: url, 
    videoQuality: "max", // High-quality 4K/8K where available
    vCodec: "vp9",       // Best quality YouTube codec
    isAudioOnly: false,
    downloadMode: "auto"
})

