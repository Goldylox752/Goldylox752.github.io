"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuctionPage({ params }) {
  const { id } = params;

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState("");
  const [timeLeft, setTimeLeft] = useState("");

  // ----------------------------
  // LOAD AUCTION + BIDS
  // ----------------------------
  useEffect(() => {
    async function loadData() {
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

    loadData();
  }, [id]);

  // ----------------------------
  // REAL-TIME BID LISTENER
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
      const now = new Date().getTime();
      const end = new Date(auction.ends_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("AUCTION CLOSED");
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${hours}h ${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auction]);

  // ----------------------------
  // PLACE BID
  // ----------------------------
  async function placeBid() {
    if (!bidAmount) return;

    await supabase.from("bids").insert({
      job_id: id,
      contractor_id: "demo-contractor", // replace with auth user
      amount: parseFloat(bidAmount),
      message: "Ready to start ASAP",
    });

    setBidAmount("");
  }

  // ----------------------------
  // LOWEST BID
  // ----------------------------
  const lowestBid = bids.length
    ? Math.min(...bids.map((b) => b.amount))
    : null;

  return (
    <div style={styles.container}>

      {/* HEADER */}
      <div style={styles.header}>
        <h1>🏠 Roof Auction</h1>
        <p>{auction?.title}</p>
        <div style={styles.timer}>{timeLeft}</div>
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
        <input
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder="Enter bid amount"
          style={styles.input}
        />
        <button onClick={placeBid} style={styles.button}>
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

// ----------------------------
// STYLES
// ----------------------------
const styles = {
  container: {
    padding: 30,
    maxWidth: 900,
    margin: "0 auto",
    color: "#fff",
    fontFamily: "Inter",
    background: "#0b1220",
    minHeight: "100vh",
  },

  header: {
    textAlign: "center",
    marginBottom: 20,
  },

  timer: {
    marginTop: 10,
    fontSize: 18,
    color: "#22c55e",
    fontWeight: "bold",
  },

  card: {
    background: "#111827",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    border: "1px solid #1f2937",
  },

  input: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #374151",
    marginTop: 10,
    background: "#0f172a",
    color: "#fff",
  },

  button: {
    marginTop: 10,
    padding: 12,
    width: "100%",
    borderRadius: 8,
    border: "none",
    background: "#22c55e",
    color: "#000",
    fontWeight: "bold",
    cursor: "pointer",
  },

  bid: {
    display: "flex",
    justifyContent: "space-between",
    padding: 10,
    border: "1px solid #1f2937",
    borderRadius: 8,
    marginTop: 10,
    background: "#0f172a",
  },
};