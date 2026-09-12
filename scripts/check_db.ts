import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

async function checkDb() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing credentials");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  // Check auth and current role
  console.log("Checking session role...");
  const { data: claims, error: rpcErr } = await supabase.rpc("get_role");
  console.log("Role RPC result:", { claims, error: rpcErr });

  const { data: user, error } = await supabase.auth.getUser();
  console.log("Auth user:", user, "Error:", error);

  // Check tables
  const tables = ["profiles", "stores", "pulse_scores", "complaints", "cases", "fraud_reviews"];

  const results = {};
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    if (error) {
      results[t] = `Error: ${error.message}`;
    } else {
      results[t] = `Count: ${count}`;
    }
  }

  const { data: profs } = await supabase.from("profiles").select("id, role, email, full_name");
  console.log("Profiles:", profs);

  console.log(JSON.stringify(results, null, 2));
}

checkDb();
