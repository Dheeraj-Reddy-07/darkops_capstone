import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

async function fixCustomer() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Checking customer data...");

  // 1. Get the customer profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", "customer@darkops.com")
    .single();

  console.log("Profile:", profile);
  console.log("Profile error:", profileErr);

  if (!profile) {
    console.error("Customer profile not found!");
    return;
  }

  // 2. Check if customer record exists
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("email", "customer@darkops.com")
    .single();

  console.log("Customer:", customer);
  console.log("Customer error:", custErr);

  if (!customer) {
    console.log("Customer record not found, creating it...");
    const { error: insertErr } = await supabase.from("customers").insert({
      id: "CU-DEMO-001",
      full_name: "Test Customer",
      email: "customer@darkops.com",
      profile_id: profile.id,
      city: "Bengaluru",
    });
    if (insertErr) {
      console.error("Failed to create customer:", insertErr);
    } else {
      console.log("Customer created successfully!");
    }
  } else {
    console.log("Customer record exists, checking profile_id...");
    if (!customer.profile_id) {
      console.log("Updating customer with profile_id...");
      const { error: updateErr } = await supabase
        .from("customers")
        .update({ profile_id: profile.id })
        .eq("id", customer.id);
      if (updateErr) {
        console.error("Failed to update customer:", updateErr);
      } else {
        console.log("Customer updated successfully!");
      }
    } else {
      console.log("Customer already has profile_id:", customer.profile_id);
    }
  }

  // 3. Check orders
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", "CU-DEMO-001");

  console.log("Orders for CU-DEMO-001:", orders?.length || 0);

  if (!orders || orders.length === 0) {
    console.log("Creating demo orders...");
    const demoOrderIds = ["ORD-DEMO-001", "ORD-DEMO-002", "ORD-DEMO-003"];
    const orderRows = demoOrderIds.map((orderId, idx) => ({
      id: orderId,
      customer_id: "CU-DEMO-001",
      store_id: "DS-1462",
      placed_at: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
      status: idx === 0 ? "out_for_delivery" : "delivered",
      total_amount_paise: 2500 + idx * 500,
      item_count: 3 + idx,
    }));

    const { error: orderErr } = await supabase.from("orders").insert(orderRows);
    if (orderErr) {
      console.error("Failed to create orders:", orderErr);
    } else {
      console.log("Orders created successfully!");
    }
  }

  console.log("Done!");
}

fixCustomer().catch(console.error);
