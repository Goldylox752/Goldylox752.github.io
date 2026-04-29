"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ============================
// SUPABASE CLIENT
// ============================
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================
// PAGE
// ============================
export default function AuctionPage({ params }: { params: { id: string } }) {
  const auctionId = params.id;

  // ----------------------------
  // STATE
  // ----------------------------
  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [bidAmount, setBidAmount] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const [user, setUser] = useState<any>(null);

  // ----------------------------
  // DERIVED VALUES
  // ----------------------------
  const lowestBid = useMemo(
    () => (bids.length ? Math.min(...bids.map((b) => b.amount)) : null),
    [bids]
  );

  const bidCount = bids.length;

  // ============================
  // LOAD USER
  // ============================
  useEffect(() => {
    const loadUser = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", auth.user.id)
        .single();

      setUser(data || null);
    };

    loadUser();
  }, []);

  // ============================
  // LOAD AUCTION + BIDS
  // ============================
  useEffect(() => {
    const load = async () => {
      const [{ data: job }, { data: bidData }] = await Promise.all([
        supabase.from("jobs").select("*").eq("id", auctionId).single(),
        supabase
          .from("bids")
          .select("*")
          .eq("job_id", auctionId)
          .order("created_at", { ascending: false }),
      ]);

      setAuction(job);
      setBids(bidData ?? []);
    };

    load();
  }, [auctionId]);

  // ============================
  // REAL-TIME BIDS
  // ============================
  useEffect(() => {
    const channel = supabase
      .channel(`auction-${auctionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `job_id=eq.${auctionId}`,
        },
        (payload) => {
          setBids((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

  // ============================
  // COUNTDOWN TIMER
  // ============================
  useEffect(() => {
    if (!auction?.ends_at) return;

    const interval = setInterval(() => {
      const diff = new Date(auction.ends_at).getTime() - Date.now();

      if (diff <= 0) {
        setTimeLeft("AUCTION CLOSED");
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diff / 3.6e6);
      const m = Math.floor((diff % 3.6e6) / 6e4);
      const s = Math.floor((diff % 6e4) / 1000);

      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [auction]);

  // ============================
  // PLACE BID
  // ============================
  const placeBid = async () => {
    const amount = parseFloat(bidAmount);

    if (!amount || amount <= 0) return;

    if (!user?.paid) {
      alert("You must unlock bidding access first.");
      return;
    }

    const { data, error } = await supabase
      .from("bids")
      .insert({
        job_id: auctionId,
        contractor_id: user.id,
        amount,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setBidAmount("");
  };

  // ============================
  // UI
  // ============================
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1>🏠 Live Roof Auction</h1>
        <p>{auction?.title ?? "Loading..."}</p>

        <div style={styles.timer}>{timeLeft}</div>

        <p style={{ color: "#9ca3af" }}>
          {bidCount} contractors competing
        </p>
      </div>

      {/* JOB */}
      <div style={styles.card}>
        <h3>Job Details</h3>
        <p>{auction?.description}</p>
        <p>📍 {auction?.location}</p>
      </div>

      {/* BID */}
      <div style={styles.card}>
        <h3>Place Your Bid</h3>

        {!user?.paid && (
          <p style={{ color: "#f87171" }}>
            🔒 Bidding access required
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