const { data } = await supabase
  .from("verified_sessions")
  .select("*")
  .eq("session_id", token)
  .gt("expires_at", new Date().toISOString())
  .maybeSingle();

return { valid: !!data, plan: data?.plan };