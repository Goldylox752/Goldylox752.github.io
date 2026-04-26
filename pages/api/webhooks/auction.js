export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const event = req.body;

    console.log("Auction event received:", event);

    switch (event.type) {

      // 🟢 New bid placed
      case "bid.created": {
        const { auctionId, userId, amount } = event.data;

        // TODO: update DB
        // await db.bids.insert(...)
        // await db.auctions.updateCurrentPrice(...)

        break;
      }

      // 🔴 Auction closed
      case "auction.closed": {
        const { auctionId, winnerId } = event.data;

        // TODO:
        // mark auction as closed
        // notify winner
        // trigger payment flow

        break;
      }

      // 🟡 Auction started
      case "auction.started": {
        const { auctionId } = event.data;

        // TODO: set status active

        break;
      }

      default:
        console.log("Unhandled auction event:", event.type);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error("Auction webhook error:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
}