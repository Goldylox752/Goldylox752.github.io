"use client";

import { placeBid } from "@/lib/bids";

export default function BidButton({ jobId, user, amount, onSuccess }) {

  async function handleClick() {
    const result = await placeBid({
      jobId,
      user,
      amount,
    });

    if (result) {
      onSuccess?.(); // refresh UI or show animation
    }
  }

  return (
    <button
      onClick={handleClick}
      style={{
        padding: 12,
        background: "#22c55e",
        border: "none",
        borderRadius: 8,
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      Place Bid
    </button>
  );
}