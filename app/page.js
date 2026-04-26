"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [bids, setBids] = useState({});

  // ----------------------------
  // LOAD JOBS
  // ----------------------------
  useEffect(() => {
    async function loadJobs() {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "live")
        .order("created_at", { ascending: false });

      setJobs(data || []);
    }

    loadJobs();
  }, []);

  // ----------------------------
  // REAL-TIME BIDS
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
  // PLACE BID (demo)
  // ----------------------------
  async function placeBid(jobId, amount) {
    await supabase.from("bids").insert({
      job_id: jobId,
      contractor_id: "demo-user",
      amount,
    });
  }

  return (
    <div style={styles.container}>

      <h1 style={styles.title}>🏠 Live Roof Auctions</h1>

      <div style={styles.grid}>

        {jobs.map((job) => {
          const jobBids = bids[job.id] || [];

          const lowestBid = jobBids.length
            ? Math.min(...jobBids.map(b => b.amount))
            : null;

          return (
            <div key={job.id} style={styles.card}>

              <h3>{job.title}</h3>
              <p style={styles.text}>{job.location}</p>

              {/* WINNING BID */}
              <div style={styles.box}>
                💰 Lowest Bid:{" "}
                <b>{lowestBid ? `$${lowestBid}` : "No bids yet"}</b>
              </div>

              {/* ACTIONS */}
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