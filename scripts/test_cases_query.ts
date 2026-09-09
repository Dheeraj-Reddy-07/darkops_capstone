import { CaseFilterSchema } from "../server/schemas/case.schemas.js";
import { createSupabaseServiceRoleClient } from "../server/lib/supabase.js";
import dotenv from "dotenv";

dotenv.config();

async function runTest() {
  console.log("--- Testing Schema ---");
  try {
    const parsed = CaseFilterSchema.parse({ limit: "100" });
    console.log("Schema parsed successfully:", parsed);
  } catch (err: any) {
    console.error("Schema parse error:", err.errors || err);
  }

  console.log("\n--- Testing Supabase Query with !inner ---");
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const { data, error, count } = await adminClient
      .from("complaints")
      .select("*, customers!inner(full_name), stores!inner(name, city)", { count: "exact" })
      .range(0, 99)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase Query Error with !inner:", error);
    } else {
      console.log("Supabase Query Success! Count:", count, "Rows returned:", data?.length);
    }
  } catch (err: any) {
    console.error("Query exception:", err);
  }

  console.log("\n--- Testing Supabase Query with left joins (no !inner) ---");
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const { data, error, count } = await adminClient
      .from("complaints")
      .select("*, customers(full_name), stores(name, city)", { count: "exact" })
      .range(0, 99)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase Query Error without !inner:", error);
    } else {
      console.log("Supabase Query Success! Count:", count, "Rows returned:", data?.length);
    }
  } catch (err: any) {
    console.error("Query exception:", err);
  }
}

runTest();
