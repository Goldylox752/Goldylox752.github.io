import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const { job_id, contractor_id, amount, user_paid } = body;

    // 🔐 SECURITY CHECK (backend protection)
    if (!user_paid) {
      return Response.json(
        { error: "Payment required to bid" },
        { status: 403 }
      );
    }

    // 🧠 Insert bid
    const { data, error } = await supabase
      .from("bids")
      .insert([
        {
          job_id,
          contractor_id,
          amount,
        },
      ])
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ bid: data });

  } catch (err) {
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}