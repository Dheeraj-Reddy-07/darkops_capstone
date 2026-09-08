import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { STORES } from "../src/lib/mock/stores";
import { CASES, AGENTS } from "../src/lib/mock/cases";
import { FRAUD_CASES } from "../src/lib/mock/fraud";
import { processComplaint } from "../server/services/automation.service";

async function seed() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Seeding DarkOps Database in Strict Relational Order...");

  // 1. Profiles & Users
  const testUsers = [
    { email: "admin@darkops.com", name: "System Admin", role: "PLATFORM_ADMIN" },
    { email: "exec@darkops.com", name: "Network Exec", role: "EXECUTIVE" },
    { email: "manager@darkops.com", name: "Ops Manager", role: "OPERATIONS" },
    { email: "fraud@darkops.com", name: "Fraud Analyst", role: "FRAUD_ANALYST" },
    { email: "support@darkops.com", name: "Customer Support", role: "CUSTOMER_SUPPORT" },
    { email: "agent.a@darkops.com", name: "Priya Sharma", role: "CUSTOMER_SUPPORT" },
    { email: "agent.b@darkops.com", name: "Rohan Mehta", role: "CUSTOMER_SUPPORT" },
    { email: "agent.c@darkops.com", name: "Sneha Patel", role: "CUSTOMER_SUPPORT" },
    { email: "normal@darkops.com", name: "Rajat Sharma", role: "CUSTOMER" },
    { email: "suspicious@darkops.com", name: "Vikram Malhotra", role: "CUSTOMER" },
    { email: "sla@darkops.com", name: "Ananya Desai", role: "CUSTOMER" },
    { email: "storemanager@darkops.com", name: "Store Manager", role: "STORE_MANAGER" },
    { email: "operations@darkops.com", name: "Operations Agent", role: "OPERATIONS" },
  ];

  const createdProfiles: Record<string, any> = {};

  for (const tu of testUsers) {
    // First, try to get existing profile by email
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", tu.email)
      .single();

    if (existingProfile) {
      createdProfiles[tu.email] = existingProfile;
      console.log(`Found existing profile for ${tu.email}`);
      continue;
    }

    // Profile doesn't exist — use admin API (service role) to create auth user immediately,
    // bypassing email confirmation. This is required for seed accounts.
    const { data: adminAuthData, error: adminAuthError } = await supabase.auth.admin.createUser({
      email: tu.email,
      password: "password123",
      email_confirm: true, // marks email as confirmed immediately
      user_metadata: { full_name: tu.name },
    });

    if (adminAuthError) {
      // If admin create failed (e.g. user already exists in auth but not profiles), try to list user
      console.warn(`Admin createUser failed for ${tu.email}: ${adminAuthError.message}`);

      // Attempt to look up existing auth user by email via admin listUsers
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingAuthUser = listData?.users?.find((u: any) => u.email === tu.email);

      if (existingAuthUser) {
        const profileData: any = {
          id: existingAuthUser.id,
          email: tu.email,
          full_name: tu.name,
          role: tu.role,
          store_id: tu.role === "STORE_MANAGER" ? "DS-1462" : null,
        };
        const { error: profileErr } = await supabase.from("profiles").upsert(profileData);
        if (profileErr) console.error(`Profile upsert error for ${tu.email}:`, profileErr.message);
        else {
          createdProfiles[tu.email] = profileData;
          console.log(`Recovered existing auth user for ${tu.email}: ${existingAuthUser.id}`);
        }
      } else {
        console.error(`Could not create or find auth user for ${tu.email} — skipping.`);
      }
      continue;
    }

    const userId = adminAuthData.user?.id;
    if (userId) {
      const profileData: any = {
        id: userId,
        email: tu.email,
        full_name: tu.name,
        role: tu.role,
        store_id: tu.role === "STORE_MANAGER" ? "DS-1462" : null,
      };
      const { error: profileErr } = await supabase.from("profiles").upsert(profileData);
      if (profileErr) console.error(`Profile upsert error for ${tu.email}:`, profileErr.message);
      else {
        createdProfiles[tu.email] = profileData;
        console.log(`Created auth user + profile for ${tu.email}: ${userId}`);
      }
    }
  }

  // 2. Stores
  const storeRows = STORES.map((s) => ({
    id: s.id,
    name: s.name,
    city: s.city,
    zone: s.zone,
    manager_name: s.manager,
    pickers_on_shift: s.pickers,
    riders_assigned: s.riders,
    is_active: true,
    manager_profile_id: s.id === "DS-1462" ? createdProfiles["storemanager@darkops.com"]?.id : null,
  }));
  await supabase.from("stores").upsert(storeRows);

  // 3. Equipment Assets
  const equipmentRows = STORES.flatMap((s) => [
    {
      id: `EQ-${s.id}-1`,
      store_id: s.id,
      name: "Walk-in Freezer",
      type: "refrigeration",
      status: s.id === "DS-1462" ? "failed" : "operational",
    },
    {
      id: `EQ-${s.id}-2`,
      store_id: s.id,
      name: "Conveyor Belt",
      type: "conveyor",
      status: "operational",
    },
    {
      id: `EQ-${s.id}-3`,
      store_id: s.id,
      name: "Handheld Scanners",
      type: "scanner",
      status: "operational",
    },
  ]);
  await supabase.from("equipment_assets").upsert(equipmentRows);

  // 4. Delivery Partners
  const dpRows = STORES.map((s) => ({
    id: `DP-${s.id}-1`,
    name: `Partner ${s.city}`,
    phone: "+919876543210",
    store_id: s.id,
    status: "active",
  }));
  await supabase.from("delivery_partners").upsert(dpRows);

  // 5. Customers
  const customerIds = new Set();
  const customerRows: any[] = [];
  const normalId = "CU-NORMAL-001";
  const suspId = "CU-SUSP-001";
  const slaId = "CU-SLA-001";

  const normalProfile = createdProfiles["normal@darkops.com"]?.id;
  const suspProfile = createdProfiles["suspicious@darkops.com"]?.id;
  const slaProfile = createdProfiles["sla@darkops.com"]?.id;

  if (normalProfile) {
    customerRows.push({ id: normalId, full_name: "Rajat Sharma", email: "normal@darkops.com", profile_id: normalProfile, city: "Bengaluru", prior_claims_90d: 1 });
    customerIds.add(normalId);
  }
  if (suspProfile) {
    customerRows.push({ id: suspId, full_name: "Vikram Malhotra", email: "suspicious@darkops.com", profile_id: suspProfile, city: "Bengaluru", prior_claims_90d: 5 });
    customerIds.add(suspId);
  }
  if (slaProfile) {
    customerRows.push({ id: slaId, full_name: "Ananya Desai", email: "sla@darkops.com", profile_id: slaProfile, city: "Bengaluru", prior_claims_90d: 2 });
    customerIds.add(slaId);
  }

  for (const c of CASES) {
    if (!customerIds.has(c.customerId)) {
      customerIds.add(c.customerId);
      customerRows.push({
        id: c.customerId,
        full_name: c.customerName,
        email: `c${c.customerId.toLowerCase()}@example.com`,
        prior_claims_90d: 0,
      });
    }
  }
  const { error: customerErr } = await supabase.from("customers").upsert(customerRows, { onConflict: "id" });
  if (customerErr) console.error("Customers upsert error:", customerErr);

  // 6. Orders
  const orderRows: any[] = [];
  for (const c of CASES) {
    orderRows.push({
      id: c.orderId,
      customer_id: c.customerId,
      store_id: c.storeId,
      placed_at: new Date(Date.now() - c.ageMins * 60000).toISOString(),
      status: "delivered",
      total_amount_paise: c.orderValue * 100,
      item_count: 5,
    });
  }

  // Normal Persona: 5 orders (clean history, small values)
  if (normalProfile) {
    const statuses = ["delivered", "delivered", "delivered", "delivered", "delivered"];
    const amounts = [150, 450, 800, 320, 210];
    const itemCounts = [1, 3, 5, 2, 2];
    const items = ["Bread", "Milk, Eggs, Curd", "Rice, Dal, Oil, Spices, Atta", "Snacks, Juice", "Vegetables"];
    for (let i = 0; i < 5; i++) {
      orderRows.push({
        id: `ORD-NORM-00${i + 1}`,
        customer_id: normalId,
        store_id: "DS-1462",
        placed_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
        status: statuses[i],
        total_amount_paise: amounts[i] * 100,
        item_count: itemCounts[i],
        items_preview: items[i],
        delivered_at: new Date(Date.now() - (i + 1) * 86400000 + 1200000).toISOString(),
      });
    }
  }

  // Suspicious Persona: 3 orders, all high value
  if (suspProfile) {
    for (let i = 0; i < 3; i++) {
      orderRows.push({
        id: `ORD-SUSP-00${i + 1}`,
        customer_id: suspId,
        store_id: "DS-1462",
        placed_at: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
        status: "delivered",
        total_amount_paise: 4500 * 100,
        item_count: 8,
        items_preview: "Premium Items, Electronics, Bulk Groceries",
        delivered_at: new Date(Date.now() - (i + 2) * 86400000 + 1500000).toISOString(),
      });
    }
  }

  // SLA Persona: 2 orders
  if (slaProfile) {
    for (let i = 0; i < 2; i++) {
      orderRows.push({
        id: `ORD-SLA-00${i + 1}`,
        customer_id: slaId,
        store_id: "DS-1462",
        placed_at: new Date(Date.now() - (i + 5) * 86400000).toISOString(),
        status: "delivered",
        total_amount_paise: 1200 * 100,
        item_count: 4,
        items_preview: "Daily Essentials",
        delivered_at: new Date(Date.now() - (i + 5) * 86400000 + 1800000).toISOString(),
      });
    }
  }
  const { error: orderErr } = await supabase.from("orders").upsert(orderRows, { onConflict: "id" });
  if (orderErr) console.error("Orders upsert error:", orderErr);

  // NOTE: order_items table does not exist in live DB — items are stored in orders.items_preview
  console.log("Skipping order_items insert (table not in live schema — items_preview used instead)");

  // 8. Complaints - with realistic SLA states based on age
  const complaintRows: any[] = CASES.map((c) => {
    let mappedCategory = "other";
    if (c.category === "Late delivery") mappedCategory = "late_delivery";
    if (c.category === "Quality issue") mappedCategory = "quality_issue";
    if (c.category === "Missing item") mappedCategory = "missing_item";

    // Calculate SLA state based on priority and age
    let slaTarget = 120; // default P3 = 2 hours
    if (c.priority === "P1") slaTarget = 15;
    else if (c.priority === "P2") slaTarget = 30;

    let slaState = "on_track";
    if (c.ageMins > slaTarget) slaState = "breached";
    else if (c.ageMins > slaTarget * 0.75) slaState = "at_risk";

    return {
      id: c.id,
      complaint_ref: c.complaintId,
      customer_id: c.customerId,
      order_id: c.orderId,
      store_id: c.storeId,
      summary: c.summary,
      detail: c.detail,
      category: mappedCategory,
      type: c.type === "Refund" ? "refund" : "operational_investigation",
      priority: c.priority,
      status: c.status === "Unassigned" ? "unassigned" : "assigned",
      sla_state: slaState,
      assigned_agent_id:
        c.status !== "Unassigned" ? createdProfiles["manager@darkops.com"]?.id : null,
      order_value_paise: c.orderValue * 100,
      refund_amount_paise: c.refundAmount * 100,
      created_at: new Date(Date.now() - (c.ageMins || 60) * 60000).toISOString(),
    };
  });

  // Normal Persona: 1 auto-resolve candidate
  if (normalProfile) {
    complaintRows.push({
      id: "CMP-NORM-001",
      complaint_ref: "REF-NORM-001",
      customer_id: normalId,
      order_id: "ORD-NORM-001",
      store_id: "DS-1462",
      summary: "Missing item",
      detail: "Missing 1L milk from my order. I need a refund.",
      category: "missing_item",
      type: "refund",
      priority: "P3",
      status: "unassigned",
      sla_state: "on_track",
      assigned_agent_id: null,
      order_value_paise: 15000,
      refund_amount_paise: 0,
      created_at: new Date().toISOString(),
    });
  }

  // Suspicious Persona: 2 historical complaints, 1 active highly suspicious complaint
  if (suspProfile) {
    complaintRows.push({
      id: "CMP-SUSP-001",
      complaint_ref: "REF-SUSP-001",
      customer_id: suspId,
      order_id: "ORD-SUSP-001",
      store_id: "DS-1462",
      summary: "Missing item",
      detail: "Half the items are missing again!",
      category: "missing_item",
      type: "refund",
      priority: "P2",
      status: "unassigned", // will trigger risk review
      sla_state: "on_track",
      assigned_agent_id: null,
      order_value_paise: 450000,
      refund_amount_paise: 0,
      created_at: new Date().toISOString(),
    });
  }

  // SLA Persona: 1 breached complaint
  if (slaProfile) {
    complaintRows.push({
      id: "CMP-SLA-001",
      complaint_ref: "REF-SLA-001",
      customer_id: slaId,
      order_id: "ORD-SLA-001",
      store_id: "DS-1462",
      summary: "Quality issue",
      detail: "The items are damaged and expired",
      category: "quality_issue",
      type: "refund",
      priority: "P3",
      status: "in_progress",
      sla_state: "breached",
      assigned_agent_id: createdProfiles["agent.c@darkops.com"]?.id,
      order_value_paise: 120000,
      refund_amount_paise: 120000,
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hours ago, P3 is 2 hours
      sla_due_at: new Date(Date.now() - 3600000).toISOString(),
    });
  }

  const { error: complaintErr } = await supabase.from("complaints").upsert(complaintRows, { onConflict: "id" });
  if (complaintErr) console.error("Complaints upsert error:", complaintErr);

  // 9. Refund Requests
  const refundRows = complaintRows
    .filter((c) => c.type === "refund" && c.refund_amount_paise > 0)
    .map((c) => ({
      id: `RR-${c.id}`,
      complaint_id: c.id,
      customer_id: c.customer_id,
      amount_paise: c.refund_amount_paise,
      status: "requested",
    }));
  await supabase.from("refund_requests").upsert(refundRows, { onConflict: "id" });

  // 10. Fraud Reviews
  const fraudRows = FRAUD_CASES.map((f: any) => ({
    id: f.id,
    complaint_id: f.caseId,
    customer_id: f.customerId,
    risk_confidence: f.confidence,
    reason: f.reason || "Unknown",
    decision: "pending_review",
  }));
  if (suspProfile) {
    fraudRows.push({
      id: "FR-SUSP-001",
      complaint_id: "CMP-SUSP-001",
      customer_id: suspId,
      risk_confidence: 96,
      reason: "High velocity of missing item claims; Device ID linked to banned account",
      decision: "pending_review",
    });
  }
  await supabase.from("fraud_reviews").upsert(fraudRows, { onConflict: "id" });

  // 11. Store Metrics Snapshots - calculate from actual operational metrics first
  await supabase
    .from("store_metrics_snapshots")
    .delete()
    .in(
      "store_id",
      STORES.map((s) => s.id),
    );
  const metricsRows = STORES.map((s) => {
    // Use the actual metrics from the store data
    const slaPct = s.sla || 95;
    const refundRatePct = s.refundRate || 5;
    const equipmentFailures14d = s.equipmentFailures14d || 0;
    const inventoryIssues = s.inventoryIssues || 0;
    const deliveryDelays = s.deliveryDelays || 0;
    const pickerDelayMins = s.pickerDelayMins || 2;
    const avgResolutionMins = s.avgResolutionMins || 60;
    const openIssues = s.openIssues || 0;

    return {
      store_id: s.id,
      sla_pct: slaPct,
      refund_rate_pct: refundRatePct,
      equipment_failures_14d: equipmentFailures14d,
      inventory_issues: inventoryIssues,
      delivery_delays: deliveryDelays,
      picker_delay_mins: pickerDelayMins,
      avg_resolution_mins: avgResolutionMins,
      open_issues: openIssues,
    };
  });
  await supabase.from("store_metrics_snapshots").insert(metricsRows);

  // 12. Pulse Scores - calculate from actual metrics using real formula
  await supabase
    .from("pulse_scores")
    .delete()
    .in(
      "store_id",
      STORES.map((s) => s.id),
    );
  const pulseRows = metricsRows.flatMap((m) => {
    // We will generate 30 days of historical pulse scores
    const history = [];

    // We want a slight trend. Generate a random delta (-2 to 2) per day
    // We'll calculate the base (today's) points first:
    const equipmentBase = Math.round(Math.min(25, m.equipment_failures_14d * 3));
    const slaBase = Math.round(Math.min(25, Math.max(0, (95 - m.sla_pct) * 0.5)));
    const refundsBase = Math.round(Math.min(20, Math.max(0, (m.refund_rate_pct - 2) * 1)));
    const deliveryBase = Math.round(Math.min(15, m.delivery_delays * 0.5));
    const pickerBase = Math.round(Math.min(10, Math.max(0, (m.picker_delay_mins - 2.5) * 2)));
    const inventoryBase = Math.round(Math.min(10, m.inventory_issues * 1));

    // Go back 30 days
    for (let day = 30; day >= 0; day--) {
      const calculatedAt = new Date(Date.now() - day * 86400000).toISOString();

      // Add some random noise that decays into the past
      // To ensure we don't violate constraints, we must clamp again
      const noise = () => Math.round((Math.random() - 0.5) * 3);

      const equipmentPts = Math.round(
        Math.min(25, Math.max(0, equipmentBase + (day > 0 ? noise() : 0))),
      );
      const slaPts = Math.round(Math.min(25, Math.max(0, slaBase + (day > 0 ? noise() : 0))));
      const refundsPts = Math.round(
        Math.min(20, Math.max(0, refundsBase + (day > 0 ? noise() : 0))),
      );
      const deliveryPts = Math.round(
        Math.min(15, Math.max(0, deliveryBase + (day > 0 ? noise() : 0))),
      );
      const pickerPts = Math.round(Math.min(10, Math.max(0, pickerBase + (day > 0 ? noise() : 0))));
      const inventoryPts = Math.round(
        Math.min(10, Math.max(0, inventoryBase + (day > 0 ? noise() : 0))),
      );

      const totalDeduction =
        equipmentPts + slaPts + refundsPts + deliveryPts + pickerPts + inventoryPts;
      const pulse = Math.max(12, Math.min(100, 100 - totalDeduction));

      history.push({
        store_id: m.store_id,
        score: pulse,
        equipment_pts: equipmentPts,
        sla_pts: slaPts,
        refunds_pts: refundsPts,
        delivery_pts: deliveryPts,
        picker_pts: pickerPts,
        inventory_pts: inventoryPts,
        calculated_at: calculatedAt,
      });
    }

    return history;
  });

  // We have 31 days per store, 200 stores = 6200 rows.
  // Insert in chunks to avoid overwhelming the API.
  const chunkSize = 1000;
  for (let i = 0; i < pulseRows.length; i += chunkSize) {
    const chunk = pulseRows.slice(i, i + chunkSize);
    await supabase.from("pulse_scores").insert(chunk);
  }

  // 13. Work Orders - correlated with store health (more issues for low pulse stores)
  const workOrderRows = pulseRows
    .filter((p) => p.score < 80) // Only create work orders for stores with poor health
    .map((p, idx) => ({
      id: `WO-DS-${p.store_id}-${idx + 1}`,
      store_id: p.store_id,
      asset_id: `EQ-${p.store_id}-${idx + 1}`,
      asset_name: [
        "Walk-in freezer",
        "Chiller unit",
        "POS terminal",
        "Picker device",
        "Inventory scanner",
      ][idx % 5],
      priority: p.score < 60 ? "P1" : "P2",
      status: "open",
    }));
  await supabase.from("work_orders").upsert(workOrderRows);

  // 14. Alerts - correlated with store health (critical alerts for low pulse stores)
  const alertRows = pulseRows
    .filter((p) => p.score < 60) // Only create alerts for critical stores
    .map((p, idx) => ({
      id: `ALT-${p.store_id}-${idx + 1}`,
      store_id: p.store_id,
      title: ["Chiller failure", "SLA breach", "High refund rate", "Equipment offline"][idx % 4],
      detail: `Store ${p.store_id} health critical (Pulse: ${p.score})`,
      severity: "crit",
      is_resolved: false,
    }));
  await supabase.from("alerts").upsert(alertRows);

  // 15. Notifications - based on actual conditions
  const notificationRows: any[] = [];
  const operationsProfileId = createdProfiles["manager@darkops.com"]?.id;
  const storeManagerProfileId = createdProfiles["storemanager@darkops.com"]?.id;
  const supportProfileId = createdProfiles["support@darkops.com"]?.id;

  // Operations notifications for high-priority cases
  const highPriorityCases = complaintRows.filter(
    (c) => c.priority === "P1" && c.status !== "resolved",
  );
  highPriorityCases.slice(0, 3).forEach((c) => {
    if (operationsProfileId) {
      notificationRows.push({
        recipient_id: operationsProfileId,
        title: `P1 Case ${c.complaint_ref} requires attention`,
        meta: JSON.stringify({ complaint_id: c.id, priority: c.priority }),
        link_type: "complaint",
        link_ref: c.id,
      });
    }
  });

  // Store manager notifications for critical stores
  const criticalStores = pulseRows.filter((p) => p.score < 60);
  criticalStores.forEach((p) => {
    if (storeManagerProfileId) {
      notificationRows.push({
        recipient_id: storeManagerProfileId,
        title: `Store ${p.store_id} PulseScore critical (${p.score})`,
        meta: JSON.stringify({ store_id: p.store_id, pulse: p.score }),
        link_type: "store",
        link_ref: p.store_id,
      });
    }
  });

  // Customer notifications
  if (normalProfile) {
    notificationRows.push({
      recipient_id: normalProfile,
      title: "Order delivered",
      meta: JSON.stringify({ order_id: "ORD-NORM-001" }),
      link_type: "order",
      link_ref: "ORD-NORM-001",
    });
  }
  if (suspProfile) {
    notificationRows.push({
      recipient_id: suspProfile,
      title: "Order delivered",
      meta: JSON.stringify({ order_id: "ORD-SUSP-001" }),
      link_type: "order",
      link_ref: "ORD-SUSP-001",
    });
  }
  if (slaProfile) {
    notificationRows.push({
      recipient_id: slaProfile,
      title: "Complaint SLA exceeded",
      meta: JSON.stringify({ complaint_id: "CMP-SLA-001" }),
      link_type: "complaint",
      link_ref: "CMP-SLA-001",
    });
  }

  // Customer support notifications for high-risk cases
  const highRiskFraud = fraudRows.filter((f: any) => f.risk_confidence >= 90);
  highRiskFraud.slice(0, 2).forEach((f: any) => {
    if (supportProfileId) {
      notificationRows.push({
        recipient_id: supportProfileId,
        title: `High-risk case review required (${f.risk_confidence}% confidence)`,
        meta: JSON.stringify({ fraud_review_id: f.id, confidence: f.risk_confidence }),
        link_type: "fraud",
        link_ref: f.id,
      });
    }
  });

  if (notificationRows.length > 0) {
    await supabase.from("notifications").insert(notificationRows);
  }

  console.log("Seeding support workspace: agents, tickets, and activity...");

  // 16. Support Tickets — distributed across 3 agents + unassigned
  const agentAId = createdProfiles["agent.a@darkops.com"]?.id;
  const agentBId = createdProfiles["agent.b@darkops.com"]?.id;
  const agentCId = createdProfiles["agent.c@darkops.com"]?.id;

  if (!agentAId || !agentBId || !agentCId) {
    console.warn(
      "Support agents not found — skipping ticket seed. Run migration first and ensure agents are registered.",
    );
    console.log("Agent A:", agentAId, "Agent B:", agentBId, "Agent C:", agentCId);
  } else {
    const slaIn = (mins: number) => new Date(Date.now() + mins * 60000).toISOString();
    const slaAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();
    const createdAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();

    // Delete any previously seeded tickets by ticket_number to allow idempotent re-runs
    const seedTicketNumbers = [
      "TKT-001",
      "TKT-002",
      "TKT-003",
      "TKT-004",
      "TKT-005",
      "TKT-006",
      "TKT-007",
      "TKT-008",
      "TKT-009",
      "TKT-010",
      "TKT-011",
      "TKT-012",
      "TKT-013",
      "TKT-014",
      "TKT-015",
      "TKT-016",
      "TKT-017",
      "TKT-018",
      "TKT-019",
      "TKT-020",
      "TKT-021",
      "TKT-022",
      "TKT-023",
      "TKT-024",
      "TKT-025",
    ];
    await supabase.from("support_tickets").delete().in("ticket_number", seedTicketNumbers);

    // Insert tickets WITHOUT id — Supabase will generate UUIDs
    const supportTickets = [
      // ── Agent A (Priya Sharma) — 5 tickets ───────────────────────────────────
      {
        ticket_number: "TKT-001",
        title: "Refund validation failed – duplicate order claim",
        complaint_id: complaintRows[0]?.id || null,
        assigned_to: agentAId,
        created_by: agentAId,
        status: "in_progress",
        priority: "P1",
        queue: "refunds",
        sla_deadline: slaIn(18),
        created_at: createdAgo(92),
        updated_at: createdAgo(10),
      },
      {
        ticket_number: "TKT-002",
        title: "Missing item – 1L Amul milk not delivered",
        complaint_id: complaintRows[1]?.id || null,
        assigned_to: agentAId,
        created_by: agentAId,
        status: "open",
        priority: "P2",
        queue: "general",
        sla_deadline: slaIn(74),
        created_at: createdAgo(46),
        updated_at: createdAgo(46),
      },
      {
        ticket_number: "TKT-003",
        title: "Late delivery – order 47 mins overdue",
        complaint_id: complaintRows[2]?.id || null,
        assigned_to: agentAId,
        created_by: agentAId,
        status: "open",
        priority: "P2",
        queue: "general",
        sla_deadline: slaAgo(42),
        created_at: createdAgo(72),
        updated_at: createdAgo(72),
      },
      {
        ticket_number: "TKT-004",
        title: "Wrong items packed – customer received incorrect order",
        complaint_id: complaintRows[3]?.id || null,
        assigned_to: agentAId,
        created_by: agentAId,
        status: "open",
        priority: "P3",
        queue: "general",
        sla_deadline: slaIn(145),
        created_at: createdAgo(15),
        updated_at: createdAgo(15),
      },
      {
        ticket_number: "TKT-005",
        title: "Damaged packaging – items spoiled on delivery",
        complaint_id: complaintRows[4]?.id || null,
        assigned_to: agentAId,
        created_by: agentAId,
        resolved_by: agentAId,
        status: "resolved",
        priority: "P3",
        queue: "general",
        sla_deadline: slaAgo(5),
        created_at: createdAgo(180),
        updated_at: createdAgo(30),
        resolution_notes: "Refund of ₹120 approved and processed. Customer notified.",
        resolution_time_minutes: 150,
      },
      // ── Agent B (Rohan Mehta) — 4 tickets ────────────────────────────────────
      {
        ticket_number: "TKT-006",
        title: "Cold chain failure – yogurt expired on delivery",
        complaint_id: complaintRows[5]?.id || null,
        assigned_to: agentBId,
        created_by: agentBId,
        status: "in_progress",
        priority: "P1",
        queue: "refunds",
        sla_deadline: slaIn(6),
        created_at: createdAgo(110),
        updated_at: createdAgo(5),
      },
      {
        ticket_number: "TKT-007",
        title: "Reorder request – auto-fulfillment failed twice",
        complaint_id: complaintRows[6]?.id || null,
        assigned_to: agentBId,
        created_by: agentBId,
        status: "open",
        priority: "P2",
        queue: "reorders",
        sla_deadline: slaIn(52),
        created_at: createdAgo(28),
        updated_at: createdAgo(28),
      },
      {
        ticket_number: "TKT-008",
        title: "High-value refund – ₹2,400 dispute unresolved",
        complaint_id: complaintRows[7]?.id || null,
        assigned_to: agentBId,
        created_by: agentBId,
        status: "escalated",
        priority: "P1",
        queue: "escalated",
        sla_deadline: slaAgo(88),
        created_at: createdAgo(200),
        updated_at: createdAgo(40),
      },
      {
        ticket_number: "TKT-009",
        title: "Delivery partner dispute – undelivered order",
        complaint_id: complaintRows[8]?.id || null,
        assigned_to: agentBId,
        created_by: agentBId,
        status: "awaiting_customer",
        priority: "P3",
        queue: "general",
        sla_deadline: slaIn(280),
        created_at: createdAgo(60),
        updated_at: createdAgo(20),
      },
      // ── Agent C (Sneha Patel) — 3 tickets ─────────────────────────────────────
      {
        ticket_number: "TKT-010",
        title: "Substitution rejected – customer unhappy with replacement",
        complaint_id: complaintRows[9]?.id || null,
        assigned_to: agentCId,
        created_by: agentCId,
        status: "open",
        priority: "P2",
        queue: "general",
        sla_deadline: slaIn(95),
        created_at: createdAgo(25),
        updated_at: createdAgo(25),
      },
      {
        ticket_number: "TKT-011",
        title: "Inventory discrepancy – item shown in app, out of stock at store",
        complaint_id: complaintRows[10]?.id || null,
        assigned_to: agentCId,
        created_by: agentCId,
        status: "open",
        priority: "P3",
        queue: "operational",
        sla_deadline: slaIn(210),
        created_at: createdAgo(30),
        updated_at: createdAgo(30),
      },
      {
        ticket_number: "TKT-SLA-001",
        title: "Quality issue – items damaged and expired",
        complaint_id: "CMP-SLA-001",
        assigned_to: agentCId,
        created_by: agentCId,
        status: "open",
        priority: "P3",
        queue: "general",
        sla_deadline: slaAgo(60),
        created_at: createdAgo(180),
        updated_at: createdAgo(120),
      },
      {
        ticket_number: "TKT-012",
        title: "Double charge – payment processed twice for same order",
        complaint_id: complaintRows[11]?.id || null,
        assigned_to: agentCId,
        created_by: agentCId,
        resolved_by: agentCId,
        status: "resolved",
        priority: "P1",
        queue: "refunds",
        sla_deadline: slaAgo(20),
        created_at: createdAgo(300),
        updated_at: createdAgo(60),
        resolution_notes:
          "Confirmed duplicate charge via payment gateway. Full refund issued. Customer notified.",
        resolution_time_minutes: 240,
      },
      // ── Unassigned — 2 tickets ────────────────────────────────────────────────
      {
        ticket_number: "TKT-013",
        title: "First-time customer complaint – app crash during checkout",
        complaint_id: complaintRows[12]?.id || null,
        assigned_to: null,
        created_by: null,
        status: "open",
        priority: "P2",
        queue: "general",
        sla_deadline: slaIn(88),
        created_at: createdAgo(32),
        updated_at: createdAgo(32),
      },
      {
        ticket_number: "TKT-014",
        title: "Wallet credit not applied – promo code dispute",
        complaint_id: complaintRows[13]?.id || null,
        assigned_to: null,
        created_by: null,
        status: "open",
        priority: "P3",
        queue: "refunds",
        sla_deadline: slaIn(380),
        created_at: createdAgo(10),
        updated_at: createdAgo(10),
      },
      // ── Additional tickets for more realistic volume ───────────────────────────────
      // Agent A additional tickets
      {
        ticket_number: "TKT-015",
        title: "Payment gateway timeout – order stuck in processing",
        complaint_id: null,
        assigned_to: agentAId,
        created_by: agentAId,
        status: "open",
        priority: "P2",
        queue: "operational",
        sla_deadline: slaIn(65),
        created_at: createdAgo(55),
        updated_at: createdAgo(55),
      },
      {
        ticket_number: "TKT-016",
        title: "Customer unable to apply coupon – discount not working",
        complaint_id: null,
        assigned_to: agentAId,
        created_by: agentAId,
        status: "open",
        priority: "P3",
        queue: "general",
        sla_deadline: slaIn(200),
        created_at: createdAgo(40),
        updated_at: createdAgo(40),
      },
      {
        ticket_number: "TKT-017",
        title: "Order cancellation failed – charged despite cancellation",
        complaint_id: null,
        assigned_to: agentAId,
        created_by: agentAId,
        status: "in_progress",
        priority: "P1",
        queue: "refunds",
        sla_deadline: slaIn(25),
        created_at: createdAgo(85),
        updated_at: createdAgo(15),
      },
      // Agent B additional tickets
      {
        ticket_number: "TKT-018",
        title: "Store delivery zone issue – customer outside coverage area",
        complaint_id: null,
        assigned_to: agentBId,
        created_by: agentBId,
        status: "awaiting_customer",
        priority: "P3",
        queue: "operational",
        sla_deadline: slaIn(180),
        created_at: createdAgo(95),
        updated_at: createdAgo(25),
      },
      {
        ticket_number: "TKT-019",
        title: "Account suspension dispute – customer claims unauthorized activity",
        complaint_id: null,
        assigned_to: agentBId,
        created_by: agentBId,
        status: "escalated",
        priority: "P1",
        queue: "escalated",
        sla_deadline: slaAgo(120),
        created_at: createdAgo(250),
        updated_at: createdAgo(60),
      },
      {
        ticket_number: "TKT-020",
        title: "Bulk order discount not applied – corporate account issue",
        complaint_id: null,
        assigned_to: agentBId,
        created_by: agentBId,
        status: "open",
        priority: "P2",
        queue: "refunds",
        sla_deadline: slaIn(95),
        created_at: createdAgo(35),
        updated_at: createdAgo(35),
      },
      // Agent C additional tickets
      {
        ticket_number: "TKT-021",
        title: "Delivery time slot not respected – arrived 2 hours late",
        complaint_id: null,
        assigned_to: agentCId,
        created_by: agentCId,
        status: "open",
        priority: "P2",
        queue: "general",
        sla_deadline: slaIn(85),
        created_at: createdAgo(45),
        updated_at: createdAgo(45),
      },
      {
        ticket_number: "TKT-022",
        title: "Quality complaint – vegetables received spoiled",
        complaint_id: null,
        assigned_to: agentCId,
        created_by: agentCId,
        status: "in_progress",
        priority: "P2",
        queue: "refunds",
        sla_deadline: slaIn(70),
        created_at: createdAgo(60),
        updated_at: createdAgo(20),
      },
      {
        ticket_number: "TKT-023",
        title: "Wrong store delivery – order sent to wrong location",
        complaint_id: null,
        assigned_to: agentCId,
        created_by: agentCId,
        resolved_by: agentCId,
        status: "resolved",
        priority: "P1",
        queue: "operational",
        sla_deadline: slaAgo(15),
        created_at: createdAgo(120),
        updated_at: createdAgo(10),
        resolution_notes: "Confirmed routing error. Store delivery credit issued to customer.",
        resolution_time_minutes: 110,
      },
      // Additional unassigned tickets
      {
        ticket_number: "TKT-024",
        title: "Payment method not accepted – UPI not working",
        complaint_id: null,
        assigned_to: null,
        created_by: null,
        status: "open",
        priority: "P2",
        queue: "operational",
        sla_deadline: slaIn(110),
        created_at: createdAgo(20),
        updated_at: createdAgo(20),
      },
      {
        ticket_number: "TKT-025",
        title: "Item out of stock – customer wants raincheck",
        complaint_id: null,
        assigned_to: null,
        created_by: null,
        status: "open",
        priority: "P3",
        queue: "general",
        sla_deadline: slaIn(240),
        created_at: createdAgo(15),
        updated_at: createdAgo(15),
      },
    ];

    const { data: insertedTickets, error: ticketErr } = await supabase
      .from("support_tickets")
      .insert(supportTickets)
      .select("id, ticket_number");

    if (ticketErr) {
      console.error("Support tickets seed error:", ticketErr.message);
    } else {
      console.log(
        `Seeded ${insertedTickets?.length} support tickets across 3 agents + 2 unassigned`,
      );

      // Build a map: ticket_number -> uuid
      const tkt: Record<string, string> = {};
      (insertedTickets || []).forEach((t: any) => {
        tkt[t.ticket_number] = t.id;
      });

      // 17. ticket_activity — realistic event log for each ticket
      const activityRows: any[] = [];

      const mkAct = (
        tn: string,
        actor_id: string | null,
        event_type: string,
        payload: any,
        minsAgo: number,
      ) => {
        const ticket_id = tkt[tn];
        if (!ticket_id) return null;
        return { ticket_id, actor_id, event_type, payload, created_at: createdAgo(minsAgo) };
      };

      const push = (act: any) => {
        if (act) activityRows.push(act);
      };

      // TKT-001 — Priya / P1 / In Progress
      push(
        mkAct(
          "TKT-001",
          null,
          "created",
          { title: "Ticket auto-created from failed automation" },
          92,
        ),
      );
      push(mkAct("TKT-001", agentAId, "assigned", { to: "Priya Sharma", from: null }, 91));
      push(mkAct("TKT-001", agentAId, "status_changed", { from: "open", to: "in_progress" }, 10));
      push(
        mkAct(
          "TKT-001",
          agentAId,
          "note_added",
          { note: "Contacted payment gateway for transaction evidence. Awaiting response." },
          8,
        ),
      );

      // TKT-002 — Priya / P2 / Open
      push(
        mkAct("TKT-002", null, "created", { title: "Ticket created from customer complaint" }, 46),
      );
      push(mkAct("TKT-002", agentAId, "assigned", { to: "Priya Sharma", from: null }, 45));

      // TKT-003 — Priya / P2 / SLA Breached
      push(
        mkAct(
          "TKT-003",
          null,
          "created",
          { title: "Ticket created from late delivery report" },
          72,
        ),
      );
      push(mkAct("TKT-003", agentAId, "assigned", { to: "Priya Sharma", from: null }, 71));

      // TKT-004 — Priya / P3 / Open
      push(
        mkAct(
          "TKT-004",
          null,
          "created",
          { title: "Ticket created from wrong items complaint" },
          15,
        ),
      );
      push(mkAct("TKT-004", agentAId, "assigned", { to: "Priya Sharma", from: null }, 14));

      // TKT-005 — Priya / Resolved
      push(
        mkAct(
          "TKT-005",
          null,
          "created",
          { title: "Ticket created from damaged goods report" },
          180,
        ),
      );
      push(mkAct("TKT-005", agentAId, "assigned", { to: "Priya Sharma", from: null }, 179));
      push(mkAct("TKT-005", agentAId, "status_changed", { from: "open", to: "in_progress" }, 60));
      push(
        mkAct(
          "TKT-005",
          agentAId,
          "resolved",
          { note: "Refund of ₹120 approved and processed. Customer notified." },
          30,
        ),
      );

      // TKT-006 — Rohan / P1 / In Progress (SLA at risk)
      push(mkAct("TKT-006", null, "created", { title: "Cold chain failure auto-escalated" }, 110));
      push(mkAct("TKT-006", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 109));
      push(mkAct("TKT-006", agentBId, "status_changed", { from: "open", to: "in_progress" }, 5));

      // TKT-007 — Rohan / P2 / Open
      push(
        mkAct("TKT-007", null, "created", { title: "Reorder fulfillment failure escalated" }, 28),
      );
      push(mkAct("TKT-007", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 27));

      // TKT-008 — Rohan / P1 / Escalated / SLA Breached
      push(mkAct("TKT-008", null, "created", { title: "High-value dispute created" }, 200));
      push(mkAct("TKT-008", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 199));
      push(mkAct("TKT-008", agentBId, "status_changed", { from: "open", to: "in_progress" }, 80));
      push(
        mkAct("TKT-008", agentBId, "status_changed", { from: "in_progress", to: "escalated" }, 40),
      );
      push(
        mkAct(
          "TKT-008",
          agentBId,
          "note_added",
          {
            note: "Escalated to L2 — requires payment gateway review for ₹2,400 duplicate charge.",
          },
          40,
        ),
      );

      // TKT-009 — Rohan / P3 / Awaiting Customer
      push(mkAct("TKT-009", null, "created", { title: "Delivery dispute opened" }, 60));
      push(mkAct("TKT-009", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 59));
      push(
        mkAct("TKT-009", agentBId, "status_changed", { from: "open", to: "awaiting_customer" }, 20),
      );
      push(
        mkAct(
          "TKT-009",
          agentBId,
          "note_added",
          { note: "Requested delivery photo proof from customer. Awaiting response within 24h." },
          20,
        ),
      );

      // TKT-010 — Sneha / P2 / Open
      push(mkAct("TKT-010", null, "created", { title: "Substitution complaint opened" }, 25));
      push(mkAct("TKT-010", agentCId, "assigned", { to: "Sneha Patel", from: null }, 24));

      // TKT-011 — Sneha / P3 / Open
      push(mkAct("TKT-011", null, "created", { title: "Inventory discrepancy reported" }, 30));
      push(mkAct("TKT-011", agentCId, "assigned", { to: "Sneha Patel", from: null }, 29));

      // TKT-012 — Sneha / P1 / Resolved
      push(mkAct("TKT-012", null, "created", { title: "Double charge dispute raised" }, 300));
      push(mkAct("TKT-012", agentCId, "assigned", { to: "Sneha Patel", from: null }, 299));
      push(mkAct("TKT-012", agentCId, "status_changed", { from: "open", to: "in_progress" }, 120));
      push(
        mkAct(
          "TKT-012",
          agentCId,
          "resolved",
          { note: "Full refund issued after payment gateway confirmed duplicate charge." },
          60,
        ),
      );

      // TKT-013, TKT-014 — Unassigned
      push(mkAct("TKT-013", null, "created", { title: "New ticket from app crash report" }, 32));
      push(mkAct("TKT-014", null, "created", { title: "Wallet promo dispute opened" }, 10));

      // Additional tickets activity
      // TKT-015 — Agent A / P2 / Open
      push(mkAct("TKT-015", null, "created", { title: "Payment gateway timeout reported" }, 55));
      push(mkAct("TKT-015", agentAId, "assigned", { to: "Priya Sharma", from: null }, 54));

      // TKT-016 — Agent A / P3 / Open
      push(mkAct("TKT-016", null, "created", { title: "Coupon code complaint opened" }, 40));
      push(mkAct("TKT-016", agentAId, "assigned", { to: "Priya Sharma", from: null }, 39));

      // TKT-017 — Agent A / P1 / In Progress
      push(mkAct("TKT-017", null, "created", { title: "Order cancellation failure reported" }, 85));
      push(mkAct("TKT-017", agentAId, "assigned", { to: "Priya Sharma", from: null }, 84));
      push(mkAct("TKT-017", agentAId, "status_changed", { from: "open", to: "in_progress" }, 15));

      // TKT-018 — Agent B / P3 / Awaiting Customer
      push(mkAct("TKT-018", null, "created", { title: "Delivery zone dispute opened" }, 95));
      push(mkAct("TKT-018", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 94));
      push(
        mkAct("TKT-018", agentBId, "status_changed", { from: "open", to: "awaiting_customer" }, 25),
      );

      // TKT-019 — Agent B / P1 / Escalated
      push(mkAct("TKT-019", null, "created", { title: "Account suspension dispute raised" }, 250));
      push(mkAct("TKT-019", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 249));
      push(mkAct("TKT-019", agentBId, "status_changed", { from: "open", to: "in_progress" }, 120));
      push(
        mkAct("TKT-019", agentBId, "status_changed", { from: "in_progress", to: "escalated" }, 60),
      );

      // TKT-020 — Agent B / P2 / Open
      push(mkAct("TKT-020", null, "created", { title: "Bulk order discount complaint" }, 35));
      push(mkAct("TKT-020", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 34));

      // TKT-021 — Agent C / P2 / Open
      push(mkAct("TKT-021", null, "created", { title: "Delivery time slot complaint" }, 45));
      push(mkAct("TKT-021", agentCId, "assigned", { to: "Sneha Patel", from: null }, 44));

      // TKT-022 — Agent C / P2 / In Progress
      push(
        mkAct("TKT-022", null, "created", { title: "Quality complaint - spoiled vegetables" }, 60),
      );
      push(mkAct("TKT-022", agentCId, "assigned", { to: "Sneha Patel", from: null }, 59));
      push(mkAct("TKT-022", agentCId, "status_changed", { from: "open", to: "in_progress" }, 20));

      // TKT-023 — Agent C / P1 / Resolved
      push(mkAct("TKT-023", null, "created", { title: "Wrong store delivery reported" }, 120));
      push(mkAct("TKT-023", agentCId, "assigned", { to: "Sneha Patel", from: null }, 119));
      push(mkAct("TKT-023", agentCId, "status_changed", { from: "open", to: "in_progress" }, 30));
      push(
        mkAct(
          "TKT-023",
          agentCId,
          "resolved",
          { note: "Confirmed routing error. Store delivery credit issued to customer." },
          10,
        ),
      );

      // TKT-024, TKT-025 — Unassigned
      push(mkAct("TKT-024", null, "created", { title: "Payment method issue reported" }, 20));
      push(mkAct("TKT-025", null, "created", { title: "Out of stock raincheck request" }, 15));

      if (activityRows.length > 0) {
        const { error: actErr } = await supabase.from("ticket_activity").insert(activityRows);
        if (actErr) console.error("Ticket activity seed error:", actErr.message);
        else console.log(`Seeded ${activityRows.length} ticket activity events`);
      }

      // 18. Notifications for agents — SLA alerts
      const tkt001Id = tkt["TKT-001"];
      const tkt003Id = tkt["TKT-003"];
      const tkt006Id = tkt["TKT-006"];
      const agentNotifs = [
        tkt001Id && {
          recipient_id: agentAId,
          title: "TKT-001 SLA approaching — act soon",
          meta: JSON.stringify({ ticket_id: tkt001Id, ticket_number: "TKT-001" }),
          link_type: "support_ticket",
          link_ref: tkt001Id,
        },
        tkt003Id && {
          recipient_id: agentAId,
          title: "TKT-003 SLA breached — take immediate action",
          meta: JSON.stringify({ ticket_id: tkt003Id, ticket_number: "TKT-003" }),
          link_type: "support_ticket",
          link_ref: tkt003Id,
        },
        tkt006Id && {
          recipient_id: agentBId,
          title: "TKT-006 SLA at risk — 6 min remaining",
          meta: JSON.stringify({ ticket_id: tkt006Id, ticket_number: "TKT-006" }),
          link_type: "support_ticket",
          link_ref: tkt006Id,
        },
      ].filter(Boolean);

      if (agentNotifs.length > 0) {
        const { error: notifErr } = await supabase.from("notifications").insert(agentNotifs);
        if (notifErr) console.error("Agent notifications seed error:", notifErr.message);
        else console.log(`Seeded ${agentNotifs.length} agent notifications`);
      }

      // 19. Failed Automation Queue — realistic intake queue with more volume
      // Use valid complaint IDs from the seeded complaints
      const failedAutomationRows = [
        {
          complaint_id: complaintRows[0]?.id,
          failure_reason: "refund_validation",
          failure_step: "validation",
          urgency_score: 92,
          sentiment: "negative",
          resolved_at: null,
          resolved_by: null,
          notes: "Customer has high refund history (12 refunds, ₹4,500 total)",
          created_at: createdAgo(1380), // 23 hours ago
        },
        {
          complaint_id: complaintRows[1]?.id,
          failure_reason: "refund_validation",
          failure_step: "validation",
          urgency_score: 85,
          sentiment: "negative",
          resolved_at: null,
          resolved_by: null,
          notes: "Refund amount (₹2,800) exceeds threshold (₹2,000)",
          created_at: createdAgo(1380), // 23 hours ago
        },
        {
          complaint_id: complaintRows[2]?.id,
          failure_reason: "duplicate_detection",
          failure_step: "classification",
          urgency_score: 78,
          sentiment: "neutral",
          resolved_at: null,
          resolved_by: null,
          notes: "Possible duplicate complaint - 3 similar complaints in 7 days",
          created_at: createdAgo(120), // 2 hours ago
        },
        {
          complaint_id: complaintRows[3]?.id,
          failure_reason: "fraud_detection",
          failure_step: "validation",
          urgency_score: 95,
          sentiment: "negative",
          resolved_at: null,
          resolved_by: null,
          notes: "Suspicious activity pattern: new account, high value, rush order",
          created_at: createdAgo(90), // 1.5 hours ago
        },
        {
          complaint_id: complaintRows[4]?.id,
          failure_reason: "category_classification",
          failure_step: "classification",
          urgency_score: 65,
          sentiment: "neutral",
          resolved_at: null,
          resolved_by: null,
          notes: "Unable to classify complaint category - confidence 30%, ambiguous keywords",
          created_at: createdAgo(60), // 1 hour ago
        },
        {
          complaint_id: complaintRows[5]?.id,
          failure_reason: "customer_verification",
          failure_step: "validation",
          urgency_score: 88,
          sentiment: "negative",
          resolved_at: null,
          resolved_by: null,
          notes: "Customer identity verification failed - 3 attempts, phone mismatch, email bounce",
          created_at: createdAgo(45), // 45 minutes ago
        },
        {
          complaint_id: complaintRows[6]?.id,
          failure_reason: "store_integration",
          failure_step: "auto_assignment",
          urgency_score: 72,
          sentiment: "neutral",
          resolved_at: null,
          resolved_by: null,
          notes: "Store API timeout - DS-1567 /inventory endpoint, 5 retry attempts",
          created_at: createdAgo(30), // 30 minutes ago
        },
        {
          complaint_id: complaintRows[7]?.id,
          failure_reason: "payment_validation",
          failure_step: "validation",
          urgency_score: 82,
          sentiment: "negative",
          resolved_at: null,
          resolved_by: null,
          notes: "Payment transaction verification failed - TXN-789456 via Razorpay",
          created_at: createdAgo(15), // 15 minutes ago
        },
        {
          complaint_id: complaintRows[8]?.id,
          failure_reason: "auto_assignment",
          failure_step: "auto_assignment",
          urgency_score: 70,
          sentiment: "neutral",
          resolved_at: null,
          resolved_by: null,
          notes: "No available agents in queue - all agents at capacity",
          created_at: createdAgo(10), // 10 minutes ago
        },
        {
          complaint_id: complaintRows[9]?.id,
          failure_reason: "sentiment_analysis",
          failure_step: "classification",
          urgency_score: 75,
          sentiment: "neutral",
          resolved_at: null,
          resolved_by: null,
          notes: "Sentiment analysis inconclusive - mixed signals in customer message",
          created_at: createdAgo(5), // 5 minutes ago
        },
      ];

      // Clear existing failed automation data
      await supabase
        .from("failed_automation")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      const { error: failedAutoErr } = await supabase
        .from("failed_automation")
        .insert(failedAutomationRows);
      if (failedAutoErr) {
        console.error("Failed automation seed error:", failedAutoErr.message);
      } else {
        console.log(`Seeded ${failedAutomationRows.length} failed automation records`);
      }
    }
  }

  // Invoke processComplaint on our auto-resolve candidate so it's fully realistic
  console.log("Running backend automation engine on the auto-resolve candidate (CMP-NORM-001)...");
  try {
    const result = await processComplaint("CMP-NORM-001");
    console.log("Automation engine result for CMP-NORM-001:", result);
  } catch (err) {
    console.error("Failed to run automation engine during seed:", err);
  }

  console.log("Seed completed successfully!");
}

seed().catch(console.error);
