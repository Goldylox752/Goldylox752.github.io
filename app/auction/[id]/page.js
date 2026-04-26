"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ----------------------------
// SUPABASE CLIENT
// ----------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuctionPage({ params }) {
  const { id } = params;

  // ----------------------------
  // STATE
  // ----------------------------
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const [user, setUser] = useState(null);

  // ----------------------------
  // DERIVED STATE
  // ----------------------------
  const lowestBid = bids.length
    ? Math.min(...bids.map((b) => b.amount))
    : null;

  const bidCount = bids.length;

  // ----------------------------
  // LOAD USER
  // ----------------------------
  useEffect(() => {
    async function loadUser() {
      const { data: auth } = await supabase.auth.getUser();
      const authUser = auth?.user;

      if (!authUser) return;

      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      setUser(profile);
    }

    loadUser();
  }, []);

  // ----------------------------
  // LOAD AUCTION + BIDS
  // ----------------------------
  useEffect(() => {
    async function loadAuction() {
      const { data: job } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();

      const { data: bidData } = await supabase
        .from("bids")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false });

      setAuction(job);
      setBids(bidData || []);
    }

    loadAuction();
  }, [id]);

  // ----------------------------
  // REAL-TIME BID STREAM
  // ----------------------------
  useEffect(() => {
    const channel = supabase
      .channel("auction-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `job_id=eq.${id}`,
        },
        (payload) => {
          setBids((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  // ----------------------------
  // COUNTDOWN TIMER
  // ----------------------------
  useEffect(() => {
    if (!auction) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const end = new Date(auction.ends_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("AUCTION CLOSED");
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [auction]);

  // ----------------------------
  // PLACE BID
  // ----------------------------
  async function placeBid() {
    if (!bidAmount) return;

    if (!user?.paid) {
      alert("Unlock bidding access first");
      return;
    }

    const res = await fetch("/api/bids", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        job_id: id,
        contractor_id: user.id,
        amount: parseFloat(bidAmount),
        user_paid: user.paid,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Bid failed");
      return;
    }

    setBidAmount("");
  }

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div style={styles.container}>

      {/* HEADER */}
      <div style={styles.header}>
        <h1>🏠 Live Roof Auction</h1>
        <p>{auction?.title || "Loading..."}</p>

        <div style={styles.timer}>{timeLeft}</div>

        <p style={{ color: "#9ca3af" }}>
          {bidCount} contractors competing
        </p>
      </div>

      {/* JOB INFO */}
      <div style={styles.card}>
        <h3>Job Details</h3>
        <p>{auction?.description}</p>
        <p>📍 {auction?.location}</p>
      </div>

      {/* BID FORM */}
      <div style={styles.card}>
        <h3>Place Your Bid</h3>

        {!user?.paid && (
          <p style={{ color: "#f87171" }}>
            🔒 Unlock bidding access required
          </p>
        )}

        <input
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder="Enter bid amount"
          style={styles.input}
          disabled={!user?.paid}
        />

        <button
          onClick={placeBid}
          disabled={!user?.paid}
          style={{
            ...styles.button,
            opacity: user?.paid ? 1 : 0.5,
          }}
        >
          Submit Bid
        </button>
      </div>

      {/* LIVE BIDS */}
      <div style={styles.card}>
        <h3>Live Bids</h3>

        {bids.length === 0 && <p>No bids yet</p>}

        {bids.map((bid) => (
          <div
            key={bid.id}
            style={{
              ...styles.bid,
              borderColor:
                bid.amount === lowestBid ? "#22c55e" : "#1f2937",
            }}
          >
            <span>💰 ${bid.amount}</span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {new Date(bid.created_at).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}