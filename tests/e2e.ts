import { createSupabaseServiceRoleClient } from "../server/lib/supabase";
import { processComplaint } from "../server/services/automation.service";
import { analyzeComplaint } from "../server/services/nlp.service";

async function runTests() {
  const adminClient = createSupabaseServiceRoleClient();
  console.log("Starting E2E tests...");

  // Fetch existing profiles to act as customers
  const { data: profiles } = await adminClient.from("profiles").select("id").limit(2);
  const profile1 = profiles?.[0]?.id;
  const profile2 = profiles?.[1]?.id;

  if (!profile1 || !profile2) {
    console.log("No profiles found to run tests. Please seed DB.");
    return;
  }

  // Fetch existing orders to act as our test bases
  const { data: orders } = await adminClient.from("orders").select("id, customer_id, store_id").limit(2);
  const lowOrder = orders?.[0]?.id;
  const highOrder = orders?.[1]?.id;
  const cleanCustomerId = orders?.[0]?.customer_id;
  const fraudCustomerId = orders?.[1]?.customer_id;
  const storeId = orders?.[0]?.store_id;

  if (!lowOrder || !highOrder) {
    console.log("No orders found to run tests. Please seed DB.");
    return;
  }

  // Set up the customer states we need for the test
  await adminClient.from("customers").update({ prior_claims_90d: 0 }).eq("id", cleanCustomerId);
  await adminClient.from("customers").update({ prior_claims_90d: 5 }).eq("id", fraudCustomerId);

  // Set up the order amounts we need for the test
  await adminClient.from("orders").update({ total_amount_paise: 10000 }).eq("id", lowOrder);
  await adminClient.from("orders").update({ total_amount_paise: 100000 }).eq("id", highOrder);

  const fraudOrder = highOrder;

  const tests = [
    {
      name: "1. Clean customer + low-value order + high-confidence complaint (EXPECTED: auto-resolved)",
      orderId: lowOrder,
      customerId: cleanCustomerId,
      category: "damaged_item",
      summary: "Damaged item",
      detail: "The bottle arrived completely broken and leaking everywhere",
      expectedRoute: "auto_approved"
    },
    {
      name: "2. Clean customer + low-value order + low-confidence/ambiguous complaint (EXPECTED: agent queue)",
      orderId: lowOrder,
      customerId: cleanCustomerId,
      category: "damaged_item",
      summary: "Damaged item",
      detail: "Something is wrong with my order",
      expectedRoute: "agent_queue"
    },
    {
      name: "3. Customer with prior claims + valid complaint (EXPECTED: agent queue)",
      orderId: fraudOrder,
      customerId: fraudCustomerId,
      category: "damaged_item",
      summary: "Damaged item",
      detail: "The bottle arrived completely broken and leaking everywhere",
      expectedRoute: "agent_queue"
    },
    {
      name: "4. High-value order + valid complaint (EXPECTED: agent queue)",
      orderId: highOrder,
      customerId: cleanCustomerId,
      category: "damaged_item",
      summary: "Damaged item",
      detail: "The bottle arrived completely broken and leaking everywhere",
      expectedRoute: "agent_queue"
    }
  ];

  let passed = 0;
  for (const t of tests) {
    const compId = `CMP-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Insert ticket first to simulate controller
    const ticketUUID = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await adminClient.from("support_tickets").insert({
      id: ticketUUID,
      ticket_number: `TNUM-${Date.now()}`,
      complaint_id: compId,
      title: t.summary,
      status: "open",
      priority: "P3",
      queue: "refunds",
    });

    const { error: insertErr } = await adminClient.from("complaints").insert({
      id: compId,
      complaint_ref: `REF-${Date.now()}`,
      customer_id: t.customerId,
      order_id: t.orderId,
      store_id: storeId,
      category: t.category,
      summary: t.summary,
      detail: t.detail,
      type: "refund", 
      status: "unassigned",
      priority: "P3",
      order_value_paise: 10000
    });
    if (insertErr) {
        console.error("Failed to insert complaint:", insertErr);
        continue;
    }

    const res = await processComplaint(compId);
    if (res.routed_to === t.expectedRoute) {
      console.log(`✅ PASS: ${t.name} (Routed to: ${res.routed_to})`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${t.name} (Routed to: ${res.routed_to}, Expected: ${t.expectedRoute})`);
    }
  }

  console.log(`\nTests Completed: ${passed}/${tests.length} passed.`);
}

runTests().catch(console.error);
