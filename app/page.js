"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [bids, setBids] = useState({}); // grouped by job_id

  // ----------------------------
  // LOAD ACTIVE AUCTIONS
  // ----------------------------
  useEffect(() => {
    async function loadJobs() {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

      setJobs(data || []);
    }

    loadJobs();
  }, []);

  // ----------------------------
  // REAL-TIME BID STREAM
  // ----------------------------
  useEffect(() => {
    const channel = supabase
      .channel("live-bids")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
        },
        (payload) => {
          const bid = payload.new;

          setBids((prev) => {
            const jobBids = prev[bid.job_id] || [];
            return {
              ...prev,
              [bid.job_id]: [bid, ...jobBids],
            };
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ----------------------------
  // PLACE BID
  // ----------------------------
  async function placeBid(jobId, amount) {
    await supabase.from("bids").insert({
      job_id: jobId,
      contractor_id: "demo-user",
      amount,
      message: "Ready to start ASAP",
    });
  }

  return (
    <div style={styles.container}>

      {/* HEADER */}
      <h1 style={styles.title}>🏠 Live Roof Auctions</h1>
      <p style={styles.subtitle}>
        Compete in real-time for high-value roofing jobs
      </p>

      {/* AUCTION LIST */}
      <div style={styles.grid}>

        {jobs.map((job) => {
          const jobBids = bids[job.id] || [];
          const lowest = jobBids.length
            ? Math.min(...jobBids.map(b => b.amount))
            : null;

          return (
            <div key={job.id} style={styles.card}>

              <h3>{job.title}</h3>
              <p style={styles.text}>{job.location}</p>

              <div style={styles.box}>
                <p>💰 Lowest Bid: {lowest ? `$${lowest}` : "No bids yet"}</p>
              </div>

              {/* QUICK BID ACTIONS */}
              <div style={styles.actions}>
                <button onClick={() => placeBid(job.id, 9500)} style={styles.button}>
                  Bid $9.5k
                </button>

                <button onClick={() => placeBid(job.id, 9000)} style={styles.buttonAlt}>
                  Bid $9k
                </button>
              </div>

              {/* LIVE FEED */}
              <div style={styles.feed}>
                {jobBids.slice(0, 3).map((bid) => (
                  <div key={bid.id} style={styles.bid}>
                    💰 ${bid.amount}
                  </div>
                ))}
              </div>

            </div>
          );
        })}

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
    background: "#0b1220",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "Inter",
  },

  title: {
    textAlign: "center",
    fontSize: 36,
    fontWeight: 800,
  },

  subtitle: {
    textAlign: "center",
    color: "#9ca3af",
    marginBottom: 30,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 20,
  },

  card: {
    background: "#111827",
    padding: 20,
    borderRadius: 14,
    border: "1px solid #1f2937",
  },

  text: {
    color: "#9ca3af",
    fontSize: 13,
  },

  box: {
    marginTop: 10,
    padding: 10,
    background: "#0f172a",
    borderRadius: 10,
  },

  actions: {
    display: "flex",
    gap: 10,
    marginTop: 15,
  },

  button: {
    flex: 1,
    padding: 10,
    background: "#22c55e",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
  },

  buttonAlt: {
    flex: 1,
    padding: 10,
    background: "#3b82f6",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer",
  },

  feed: {
    marginTop: 15,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  bid: {
    fontSize: 13,
    color: "#d1d5db",
  },
};