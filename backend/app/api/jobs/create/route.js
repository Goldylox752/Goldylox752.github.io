import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  const body = await req.json();

  const { title, description, location } = body;

  const endsAt = new Date();
  endsAt.setHours(endsAt.getHours() + 24); // 24h auction

  const { data, error } = await supabase
    .from("jobs")
    .insert([
      {
        title,
        description,
        location,
        ends_at: endsAt,
        status: "open",
      },
    ])
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ job: data });
}