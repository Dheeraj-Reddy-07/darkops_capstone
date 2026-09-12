import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

async function verify() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) process.exit(1);
  const supabase = createClient(url, key);

  console.log("--- Row Counts ---");
  const tables = [
    "profiles",
    "stores",
    "customers",
    "orders",
    "complaints",
    "fraud_reviews",
    "pulse_scores",
  ];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`${t}: ${count} rows`);
  }

  console.log("\n--- Key Records ---");
  const stores = ["DS-1462", "DS-2162", "DS-1525", "DS-1714", "DS-1756"];
  const { data } = await supabase.from("stores").select("id, name, city").in("id", stores);
  console.log(data);
}

verify();
