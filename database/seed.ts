import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { STORES } from "../src/lib/mock/stores";
import { CASES, AGENTS } from "../src/lib/mock/cases";
import { FRAUD_CASES } from "../src/lib/mock/fraud";

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
    { email: "support@darkops.com", name: "Customer Support", role: "CUSTOMER_SUPPORT" },
    { email: "customer@darkops.com", name: "Test Customer", role: "CUSTOMER" },
    { email: "storemanager@darkops.com", name: "Store Manager", role: "STORE_MANAGER" },
  ];

  const createdProfiles: Record<string, any> = {};
  
  for (const tu of testUsers) {
    // First, try to get existing profile by email
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', tu.email)
      .single();
    
    if (existingProfile) {
      createdProfiles[tu.email] = existingProfile;
      console.log(`Found existing profile for ${tu.email}`);
      continue;
    }
    
    // Profile doesn't exist, try to create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: tu.email,
      password: "demo123",
    });
    
    if (authError) {
      console.log(`Auth User creation error for ${tu.email}: ${authError.message}`);
      // Create profile with deterministic ID for demo purposes
      const userId = `user-${tu.email.replace(/[^a-zA-Z0-9]/g, '')}`;
      const profileData: any = {
        id: userId,
        email: tu.email,
        full_name: tu.name,
        role: tu.role,
        store_id: tu.role === "STORE_MANAGER" ? "DS-1462" : null
      };
      
      const { error: profileErr } = await supabase.from("profiles").upsert(profileData);
      if (profileErr) console.error("Profile insertion error:", profileErr.message);
      else createdProfiles[tu.email] = { ...profileData };
    } else {
      const userId = authData.user?.id;
      
      if (userId) {
        const profileData: any = {
          id: userId,
          email: tu.email,
          full_name: tu.name,
          role: tu.role,
          store_id: tu.role === "STORE_MANAGER" ? "DS-1462" : null
        };
        
        const { error: profileErr } = await supabase.from("profiles").upsert(profileData);
        if (profileErr) console.error("Profile insertion error:", profileErr.message);
        else createdProfiles[tu.email] = { ...profileData };
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
    manager_profile_id: s.id === "DS-1462" ? createdProfiles["storemanager@darkops.com"]?.id : null
  }));
  await supabase.from("stores").upsert(storeRows);

  // 3. Equipment Assets
  const equipmentRows = STORES.flatMap(s => [
    { id: `EQ-${s.id}-1`, store_id: s.id, name: "Walk-in Freezer", type: "refrigeration", status: s.id === "DS-1462" ? "failed" : "operational" },
    { id: `EQ-${s.id}-2`, store_id: s.id, name: "Conveyor Belt", type: "conveyor", status: "operational" },
    { id: `EQ-${s.id}-3`, store_id: s.id, name: "Handheld Scanners", type: "scanner", status: "operational" }
  ]);
  await supabase.from("equipment_assets").upsert(equipmentRows);

  // 4. Delivery Partners
  const dpRows = STORES.map(s => ({
    id: `DP-${s.id}-1`,
    name: `Partner ${s.city}`,
    phone: "+919876543210",
    store_id: s.id,
    status: 'active'
  }));
  await supabase.from("delivery_partners").upsert(dpRows);

  // 5. Customers
  const customerIds = new Set();
  const customerRows: any[] = [];
  const demoCustomerId = "CU-DEMO-001";
  
  // Create demo customer with proper profile_id mapping
  const demoCustomerProfileId = createdProfiles["customer@darkops.com"]?.id;
  console.log(`Demo customer profile ID: ${demoCustomerProfileId}`);
  
  if (demoCustomerProfileId) {
    customerRows.push({
      id: demoCustomerId,
      full_name: "Test Customer",
      email: "customer@darkops.com",
      profile_id: demoCustomerProfileId,
      city: "Bengaluru",
    });
    customerIds.add(demoCustomerId);
    console.log(`Added demo customer with profile_id: ${demoCustomerProfileId}`);
  } else {
    console.warn("Demo customer profile not found, skipping customer creation");
    console.log("Available profiles:", Object.keys(createdProfiles));
  }

  for (const c of CASES) {
    if (!customerIds.has(c.customerId)) {
      customerIds.add(c.customerId);
      customerRows.push({
        id: c.customerId,
        full_name: c.customerName,
        email: `c${c.customerId.toLowerCase()}@example.com`,
      });
    }
  }
  await supabase.from("customers").upsert(customerRows, { onConflict: "id" });

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
  
  const demoOrderIds = ["ORD-DEMO-001", "ORD-DEMO-002", "ORD-DEMO-003"];
  demoOrderIds.forEach((orderId, idx) => {
    orderRows.push({
      id: orderId,
      customer_id: demoCustomerId,
      store_id: "DS-1462",
      placed_at: new Date(Date.now() - (idx + 1) * 86400000).toISOString(),
      status: ["out_for_delivery", "delivered", "delivered"][idx],
      total_amount_paise: [2500, 3000, 3500][idx],
      item_count: [3, 4, 5][idx],
      items_preview: idx === 0 ? "Milk, Bread, Eggs" : idx === 1 ? "Rice, Dal, Oil" : "Fruits, Snacks",
      eta_at: idx === 0 ? new Date(Date.now() + 1800000).toISOString() : null,
      delivery_partner_id: `DP-DS-1462-1`
    });
  });
  await supabase.from("orders").upsert(orderRows, { onConflict: "id" });

  // 7. Order Items
  const orderItemsRows = orderRows.flatMap(o => [
    { order_id: o.id, name: "Product A", quantity: 2, unit_price_paise: 500 },
    { order_id: o.id, name: "Product B", quantity: 1, unit_price_paise: Math.max(0, o.total_amount_paise - 1000) }
  ]);
  await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Clear items
  await supabase.from("order_items").insert(orderItemsRows);

  // 8. Complaints - with realistic SLA states based on age
  const complaintRows = CASES.map((c) => {
    let mappedCategory = "other";
    if (c.category === "Late delivery") mappedCategory = "late_delivery";
    if (c.category === "Quality issue") mappedCategory = "quality_issue";
    if (c.category === "Missing item") mappedCategory = "missing_item";
    
    // Calculate SLA state based on priority and age
    let slaTarget = 120; // default P3 = 2 hours
    if (c.priority === 'P1') slaTarget = 15;
    else if (c.priority === 'P2') slaTarget = 30;
    
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
      assigned_agent_id: (c.status !== "Unassigned") ? createdProfiles["manager@darkops.com"]?.id : null,
      order_value_paise: c.orderValue * 100,
      refund_amount_paise: c.refundAmount * 100,
      created_at: new Date(Date.now() - (c.ageMins || 60) * 60000).toISOString(),
    };
  });
  
  // Add demo complaints for the customer only if customer profile exists
  if (demoCustomerProfileId) {
    complaintRows.push({
        id: "CMP-DEMO-001",
        complaint_ref: "CMP-DEMO-001",
        customer_id: demoCustomerId,
        order_id: "ORD-DEMO-002",
        store_id: "DS-1462",
        summary: "Missing item",
        detail: "Missing 1L milk",
        category: "missing_item",
        type: "refund",
        priority: "P2",
        status: "unassigned",
        sla_state: "on_track",
        assigned_agent_id: null,
        order_value_paise: 3000,
        refund_amount_paise: 6000,
        created_at: new Date(Date.now() - 3600000).toISOString(),
    });
  }
  
  await supabase.from("complaints").upsert(complaintRows, { onConflict: "id" });

  // 9. Refund Requests
  const refundRows = complaintRows.filter(c => c.type === "refund" && c.refund_amount_paise > 0).map(c => ({
    id: `RR-${c.id}`,
    complaint_id: c.id,
    customer_id: c.customer_id,
    amount_paise: c.refund_amount_paise,
    status: 'requested'
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
  await supabase.from("fraud_reviews").upsert(fraudRows, { onConflict: "id" });

  // 11. Store Metrics Snapshots - calculate from actual operational metrics first
  await supabase.from("store_metrics_snapshots").delete().in('store_id', STORES.map(s => s.id));
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
  await supabase.from("store_metrics_snapshots").upsert(metricsRows, { onConflict: "store_id" });

  // 12. Pulse Scores - calculate from actual metrics using real formula
  await supabase.from("pulse_scores").delete().in('store_id', STORES.map(s => s.id));
  const pulseRows = metricsRows.map((m) => {
    // Calculate deduction points from actual metrics
    // Equipment: each failure = 3 points
    const equipmentPts = Math.min(30, m.equipment_failures_14d * 3);
    
    // SLA: each % below 95 = 0.5 points
    const slaPts = Math.max(0, (95 - m.sla_pct) * 0.5);
    
    // Refunds: each % above 2 = 1 point
    const refundsPts = Math.max(0, (m.refund_rate_pct - 2) * 1);
    
    // Delivery: each delay > 20min = 0.5 points
    const deliveryPts = Math.min(20, m.delivery_delays * 0.5);
    
    // Picker: each minute above 2.5 = 2 points
    const pickerPts = Math.max(0, (m.picker_delay_mins - 2.5) * 2);
    
    // Inventory: each issue = 1 point
    const inventoryPts = Math.min(15, m.inventory_issues * 1);
    
    // Total deduction
    const totalDeduction = equipmentPts + slaPts + refundsPts + deliveryPts + pickerPts + inventoryPts;
    
    // Pulse score = 100 - total deduction (min 0, max 100)
    const pulse = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
    
    return {
      store_id: m.store_id,
      score: pulse,
      equipment_pts: Math.round(equipmentPts),
      sla_pts: Math.round(slaPts),
      refunds_pts: Math.round(refundsPts),
      delivery_pts: Math.round(deliveryPts),
      picker_pts: Math.round(pickerPts),
      inventory_pts: Math.round(inventoryPts),
    };
  });
  await supabase.from("pulse_scores").upsert(pulseRows, { onConflict: "store_id" });

  // 13. Work Orders - correlated with store health (more issues for low pulse stores)
  const workOrderRows = pulseRows
    .filter(p => p.score < 80) // Only create work orders for stores with poor health
    .map((p, idx) => ({
      id: `WO-DS-${p.store_id}-${idx + 1}`,
      store_id: p.store_id,
      asset_id: `EQ-${p.store_id}-${idx + 1}`,
      asset_name: ["Walk-in freezer", "Chiller unit", "POS terminal", "Picker device", "Inventory scanner"][idx % 5],
      priority: p.score < 60 ? "P1" : "P2",
      status: "open",
    }));
  await supabase.from("work_orders").upsert(workOrderRows);

  // 14. Alerts - correlated with store health (critical alerts for low pulse stores)
  const alertRows = pulseRows
    .filter(p => p.score < 60) // Only create alerts for critical stores
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
  const highPriorityCases = complaintRows.filter(c => c.priority === 'P1' && c.status !== 'resolved');
  highPriorityCases.slice(0, 3).forEach(c => {
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
  const criticalStores = pulseRows.filter(p => p.score < 60);
  criticalStores.forEach(p => {
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
  if (demoCustomerProfileId) {
    notificationRows.push({
      recipient_id: demoCustomerProfileId,
      title: "Order delivered",
      meta: JSON.stringify({ order_id: "ORD-DEMO-002" }),
      link_type: "order",
      link_ref: "ORD-DEMO-002",
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

  console.log("Seed completed successfully!");
}

seed().catch(console.error);
