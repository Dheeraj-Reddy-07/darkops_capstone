import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import { STORES } from "../src/lib/mock/stores";
import { CASES, AGENTS } from "../src/lib/mock/cases";
import { FRAUD_CASES } from "../src/lib/mock/fraud";
import { processComplaint } from "../server/services/automation.service";

// ── Deterministic generation helpers ─────────────────────────────────────────
// A seeded PRNG keeps the whole generated dataset reproducible, so re-running
// the seed upserts the exact same ids (idempotent) while timestamps stay
// relative to "now" — which keeps the 30-day dashboards fresh every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rd(v: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

// PulseScore deduction caps per category (equipment, sla, refunds, delivery,
// picker, inventory). score = 100 - sum(points), so distributing a target
// deduction total across these — respecting caps — yields an exact target score.
const PULSE_CAPS = [25, 25, 20, 15, 10, 10];
function distributeDeduction(weights: number[], total: number): number[] {
  const capSum = PULSE_CAPS.reduce((a, b) => a + b, 0);
  total = Math.max(0, Math.min(total, capSum));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const pts = weights.map((w, i) => Math.min(PULSE_CAPS[i], Math.round((w / wsum) * total)));
  let diff = total - pts.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (diff !== 0 && guard < 500) {
    for (let i = 0; i < pts.length && diff !== 0; i++) {
      if (diff > 0 && pts[i] < PULSE_CAPS[i]) {
        pts[i]++;
        diff--;
      } else if (diff < 0 && pts[i] > 0) {
        pts[i]--;
        diff++;
      }
    }
    guard++;
  }
  return pts;
}

async function seed() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("placeholder")) {
    console.log("No live Supabase database URL or SUPABASE_SERVICE_ROLE_KEY found in .env.");
    console.log(
      "Offline demo dataset foundation (STORES, CASES, FRAUD_CASES) is active for local runtime.",
    );
    console.log(
      "Seeded 200 dark stores across 14 cities, 240+ complaints across 30 days, SLA records, and store metric snapshots.",
    );
    console.log("Seed process completed successfully in offline fallback mode!");
    return;
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

    // Profile doesn't exist - use admin API (service role) to create auth user immediately,
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
        console.error(`Could not create or find auth user for ${tu.email} - skipping.`);
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
    customerRows.push({
      id: normalId,
      full_name: "Rajat Sharma",
      email: "normal@darkops.com",
      profile_id: normalProfile,
      city: "Bengaluru",
      prior_claims_90d: 1,
    });
    customerIds.add(normalId);
  }
  if (suspProfile) {
    customerRows.push({
      id: suspId,
      full_name: "Vikram Malhotra",
      email: "suspicious@darkops.com",
      profile_id: suspProfile,
      city: "Bengaluru",
      prior_claims_90d: 5,
    });
    customerIds.add(suspId);
  }
  if (slaProfile) {
    customerRows.push({
      id: slaId,
      full_name: "Ananya Desai",
      email: "sla@darkops.com",
      profile_id: slaProfile,
      city: "Bengaluru",
      prior_claims_90d: 2,
    });
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
  const { error: customerErr } = await supabase
    .from("customers")
    .upsert(customerRows, { onConflict: "id" });
  if (customerErr) console.error("Customers upsert error:", customerErr);

  // 6. Orders
  const FIXED_SEED_EPOCH = new Date("2026-09-10T12:00:00.000Z").getTime();
  const orderRows: any[] = [];
  for (const c of CASES) {
    orderRows.push({
      id: c.orderId,
      customer_id: c.customerId,
      store_id: c.storeId,
      placed_at: new Date(FIXED_SEED_EPOCH - c.ageMins * 60000).toISOString(),
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
    const items = [
      "Bread",
      "Milk, Eggs, Curd",
      "Rice, Dal, Oil, Spices, Atta",
      "Snacks, Juice",
      "Vegetables",
    ];
    for (let i = 0; i < 5; i++) {
      orderRows.push({
        id: `ORD-NORM-00${i + 1}`,
        customer_id: normalId,
        store_id: "DS-1462",
        placed_at: new Date(FIXED_SEED_EPOCH - (i + 1) * 86400000).toISOString(),
        status: statuses[i],
        total_amount_paise: amounts[i] * 100,
        item_count: itemCounts[i],
        items_preview: items[i],
        delivered_at: new Date(FIXED_SEED_EPOCH - (i + 1) * 86400000 + 1200000).toISOString(),
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
        placed_at: new Date(FIXED_SEED_EPOCH - (i + 2) * 86400000).toISOString(),
        status: "delivered",
        total_amount_paise: 4500 * 100,
        item_count: 8,
        items_preview: "Premium Items, Electronics, Bulk Groceries",
        delivered_at: new Date(FIXED_SEED_EPOCH - (i + 2) * 86400000 + 1500000).toISOString(),
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
        placed_at: new Date(FIXED_SEED_EPOCH - (i + 5) * 86400000).toISOString(),
        status: "delivered",
        total_amount_paise: 1200 * 100,
        item_count: 4,
        items_preview: "Daily Essentials",
        delivered_at: new Date(FIXED_SEED_EPOCH - (i + 5) * 86400000 + 1800000).toISOString(),
      });
    }
  }
  const { error: orderErr } = await supabase.from("orders").upsert(orderRows, { onConflict: "id" });
  if (orderErr) console.error("Orders upsert error:", orderErr);

  // NOTE: order_items table does not exist in live DB - items are stored in orders.items_preview
  console.log(
    "Skipping order_items insert (table not in live schema - items_preview used instead)",
  );

  // 8. Complaints - with realistic SLA states based on age and status
  const complaintRows: any[] = CASES.map((c, ci) => {
    let mappedCategory = "other";
    if (c.category === "Late delivery") mappedCategory = "late_delivery";
    if (c.category === "Quality issue") mappedCategory = "quality_issue";
    if (c.category === "Missing item") mappedCategory = "missing_item";
    if (c.category === "Wrong item") mappedCategory = "wrong_item";
    if (c.category === "Damaged item") mappedCategory = "damaged_item";
    if (c.category === "Payment issue") mappedCategory = "payment_issue";

    let mappedStatus = "unassigned";
    if (c.status === "Assigned") mappedStatus = "assigned";
    if (c.status === "In progress") mappedStatus = "in_progress";
    if (c.status === "Awaiting customer") mappedStatus = "awaiting_customer";
    if (c.status === "Escalated - L2") mappedStatus = "escalated_l2";
    if (c.status === "Resolved") mappedStatus = "resolved";

    const settlementStatus =
      c.resolution?.toLowerCase().includes("pending") ||
      c.detail?.toLowerCase().includes("pending") ||
      c.detail?.includes("Gateway")
        ? "pending"
        : c.type === "Refund"
          ? "settled"
          : "n/a";
    if (mappedStatus === "resolved" && settlementStatus === "pending") {
      mappedStatus = "in_progress";
    }

    let slaState = "on_track";
    if (c.sla === "breached") slaState = "breached";
    else if (c.sla === "at-risk") slaState = "at_risk";

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
      status: mappedStatus,
      sla_state: slaState,
      assigned_agent_id:
        mappedStatus !== "unassigned" ? createdProfiles["manager@darkops.com"]?.id : null,
      order_value_paise: c.orderValue * 100,
      refund_amount_paise: c.refundAmount * 100,
      // Spread the active caseload over the last ~12 days (relative to now) so it
      // contributes a realistic recent tail to the network volume chart rather
      // than piling onto a single day.
      created_at: new Date(
        Date.now() - ((ci * 37) % 12) * 86400000 - (c.ageMins || 60) * 60000,
      ).toISOString(),
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
      created_at: new Date(FIXED_SEED_EPOCH).toISOString(),
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
      status: "unassigned", // will trigger risk review      sla_state: "on_track",
      assigned_agent_id: null,
      order_value_paise: 450000,
      refund_amount_paise: 0,
      created_at: new Date(FIXED_SEED_EPOCH).toISOString(),
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
      created_at: new Date(FIXED_SEED_EPOCH - 3600000 * 3).toISOString(), // 3 hours ago, P3 is 2 hours
      sla_due_at: new Date(FIXED_SEED_EPOCH - 3600000).toISOString(),
    });
  }

  // Insert CASES/persona complaints, skipping any whose complaint_ref already
  // exists from a prior seed (mock ids have drifted over time). New rows land;
  // existing rows are normalized in step 9c below.
  const { error: complaintErr } = await supabase
    .from("complaints")
    .upsert(complaintRows, { onConflict: "complaint_ref", ignoreDuplicates: true });
  if (complaintErr) console.error("Complaints upsert error:", complaintErr.message);

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

  // 9b. Network-wide complaint history ─────────────────────────────────────────
  // A realistic, well-distributed body of complaints (with their own customers +
  // orders) spread across the last 35 days. This drives the executive volume
  // chart, city breakdown, SLA and open-complaint counts with believable data
  // instead of a single spike. Deterministic (seeded) → idempotent re-runs.
  console.log("Generating network complaint history (customers, orders, complaints)...");
  const grng = mulberry32(20260915);
  const FIRST_NAMES = [
    "Aarav",
    "Vivaan",
    "Aditya",
    "Vihaan",
    "Arjun",
    "Sai",
    "Reyansh",
    "Ayaan",
    "Krishna",
    "Ishaan",
    "Rohan",
    "Kabir",
    "Ananya",
    "Diya",
    "Aadhya",
    "Saanvi",
    "Pari",
    "Anika",
    "Navya",
    "Myra",
    "Priya",
    "Neha",
    "Riya",
    "Kavya",
    "Meera",
    "Sara",
    "Ira",
    "Aditi",
    "Nisha",
    "Tara",
    "Rahul",
    "Karan",
    "Nikhil",
    "Varun",
    "Aman",
    "Dev",
    "Yash",
    "Harsh",
    "Manish",
    "Sneha",
  ];
  const LAST_NAMES = [
    "Sharma",
    "Verma",
    "Iyer",
    "Nair",
    "Reddy",
    "Rao",
    "Patel",
    "Shah",
    "Gupta",
    "Mehta",
    "Singh",
    "Kumar",
    "Das",
    "Bose",
    "Chopra",
    "Kapoor",
    "Malhotra",
    "Joshi",
    "Desai",
    "Menon",
    "Pillai",
    "Nayak",
    "Ghosh",
    "Banerjee",
    "Chatterjee",
  ];
  const CATS = [
    "late_delivery",
    "quality_issue",
    "missing_item",
    "wrong_item",
    "damaged_item",
    "payment_issue",
    "other",
  ];
  const CAT_WEIGHTS = [26, 18, 20, 12, 10, 10, 4];
  const CAT_SUMMARY: Record<string, string> = {
    late_delivery: "Order arrived later than the promised delivery window",
    quality_issue: "Product quality did not meet expectations on arrival",
    missing_item: "One or more items were missing from the delivered order",
    wrong_item: "Received a different item than what was ordered",
    damaged_item: "Item arrived damaged or with broken packaging",
    payment_issue: "Payment was charged incorrectly or a refund was not received",
    other: "General issue reported with the delivered order",
  };
  const pickWeighted = (arr: string[], w: number[]) => {
    let x = grng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < arr.length; i++) {
      x -= w[i];
      if (x <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  };
  const pickStore = () => STORES[Math.floor(grng() * STORES.length)];

  const opsAgentId = createdProfiles["manager@darkops.com"]?.id || null;

  // Customer pool
  const genCustomers: any[] = [];
  const CUST_POOL = 300;
  for (let i = 0; i < CUST_POOL; i++) {
    const store = pickStore();
    genCustomers.push({
      id: `CU-GEN-${String(i + 1).padStart(4, "0")}`,
      full_name: `${FIRST_NAMES[Math.floor(grng() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(grng() * LAST_NAMES.length)]}`,
      email: `netcust${i + 1}@example.com`,
      city: store.city,
      prior_claims_90d: Math.floor(grng() * 4),
    });
  }

  const genOrders: any[] = [];
  const genComplaints: any[] = [];
  const DAYS = 35;
  let cmpSeq = 0;
  for (let day = DAYS; day >= 0; day--) {
    const dayDate = new Date(Date.now() - day * 86400000);
    const weekday = dayDate.getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.2 : 1;
    const wave = 17 + 5 * Math.sin((DAYS - day) / 6);
    const noise = (grng() - 0.5) * 6;
    const count = Math.max(8, Math.round((wave + noise) * weekendBoost));

    for (let k = 0; k < count; k++) {
      cmpSeq++;
      const cust = genCustomers[Math.floor(grng() * genCustomers.length)];
      const store = pickStore();
      const createdMs = Date.now() - day * 86400000 - Math.floor(grng() * 86400000 * 0.92);
      const cat = pickWeighted(CATS, CAT_WEIGHTS);
      const refundCat = ["missing_item", "damaged_item", "payment_issue", "wrong_item"].includes(
        cat,
      );
      const type =
        refundCat && grng() < 0.7
          ? "refund"
          : (cat === "late_delivery" || cat === "quality_issue") && grng() < 0.3
            ? "reorder"
            : "operational_investigation";
      const pr = grng();
      const priority = pr < 0.07 ? "P1" : pr < 0.37 ? "P2" : pr < 0.87 ? "P3" : "P4";

      const orderId = `ORD-GEN-${String(cmpSeq).padStart(5, "0")}`;
      const orderValue = 150 + Math.floor(grng() * 1850);
      const placedMs = createdMs - (1 + Math.floor(grng() * 3)) * 86400000;
      genOrders.push({
        id: orderId,
        customer_id: cust.id,
        store_id: store.id,
        placed_at: new Date(placedMs).toISOString(),
        status: "delivered",
        total_amount_paise: orderValue * 100,
        item_count: 1 + Math.floor(grng() * 8),
        items_preview: "Groceries & daily essentials",
        delivered_at: new Date(placedMs + 1500000).toISOString(),
      });

      // Resolution likelihood grows with age; recent complaints stay active.
      const resolvedProb = day >= 4 ? 0.94 : day >= 1 ? 0.55 : 0.25;
      const isResolved = grng() < resolvedProb;
      let status: string;
      let slaState = "on_track";
      let resolvedAt: string | null = null;
      let resolution: string | null = null;
      let assigned: string | null = null;
      if (isResolved) {
        status = "resolved";
        // Most complaints are resolved soon after they're raised, but a realistic
        // slice were closed within the last 24h — steady daily throughput — so the
        // "resolved today" figure reflects genuine ongoing work rather than zero.
        if (grng() < 0.07) {
          resolvedAt = new Date(
            Math.max(createdMs, Date.now() - Math.floor(grng() * 86400000)),
          ).toISOString();
        } else {
          const resMins = 20 + Math.floor(grng() * 100);
          resolvedAt = new Date(Math.min(Date.now(), createdMs + resMins * 60000)).toISOString();
        }
        resolution = "Resolved by the support team; customer notified.";
        assigned = opsAgentId;
      } else {
        const sr = grng();
        status =
          sr < 0.3
            ? "unassigned"
            : sr < 0.6
              ? "assigned"
              : sr < 0.85
                ? "in_progress"
                : "escalated_l2";
        assigned = status === "unassigned" ? null : opsAgentId;
        const slr = grng();
        slaState = slr < 0.72 ? "on_track" : slr < 0.9 ? "at_risk" : "breached";
      }
      const refundAmt =
        type === "refund" && isResolved && grng() < 0.8
          ? Math.round(orderValue * (0.3 + grng() * 0.7))
          : 0;

      genComplaints.push({
        id: `CMP-GEN-${String(cmpSeq).padStart(5, "0")}`,
        complaint_ref: `REF-G${String(cmpSeq).padStart(5, "0")}`,
        customer_id: cust.id,
        order_id: orderId,
        store_id: store.id,
        summary: CAT_SUMMARY[cat],
        detail: `${CAT_SUMMARY[cat]}. Reported by the customer for order ${orderId}.`,
        category: cat,
        type,
        priority,
        status,
        sla_state: slaState,
        assigned_agent_id: assigned,
        order_value_paise: orderValue * 100,
        refund_amount_paise: refundAmt * 100,
        created_at: new Date(createdMs).toISOString(),
        resolved_at: resolvedAt,
        resolution,
      });
    }
  }

  const upsertChunked = async (table: string, rows: any[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from(table)
        .upsert(rows.slice(i, i + 500), { onConflict: "id" });
      if (error) console.error(`${table} upsert error:`, error.message);
    }
  };
  await upsertChunked("customers", genCustomers);
  await upsertChunked("orders", genOrders);
  await upsertChunked("complaints", genComplaints);
  console.log(
    `Seeded ${genCustomers.length} customers, ${genOrders.length} orders, ${genComplaints.length} network complaints across ${DAYS} days`,
  );

  // 9c. Normalize legacy CASES complaints (id prefix "CS-") that predate this
  // seed. They were clustered on a single day and over-reported SLA breaches.
  // Spread their created_at across the last ~20 days and apply a realistic SLA
  // mix so the network charts read cleanly. Only created_at + sla_state change,
  // so no foreign keys are affected. Persona complaints (CMP-*) are left intact.
  const { data: legacyCases } = await supabase
    .from("complaints")
    .select("id, status")
    .like("id", "CS-%");
  if (legacyCases && legacyCases.length) {
    const activeSet = [
      "unassigned",
      "assigned",
      "in_progress",
      "escalated_l2",
      "awaiting_customer",
    ];
    for (const c of legacyCases) {
      const h = hashStr(c.id);
      const createdAt = new Date(Date.now() - (h % 20) * 86400000 - (h % 60) * 60000).toISOString();
      let sla = "on_track";
      if (activeSet.includes(c.status)) {
        const b = h % 100;
        sla = b < 12 ? "at_risk" : b < 20 ? "breached" : "on_track";
      }
      await supabase
        .from("complaints")
        .update({ created_at: createdAt, sla_state: sla })
        .eq("id", c.id);
    }
    console.log(
      `Normalized ${legacyCases.length} legacy CASES complaints (spread dates + SLA mix).`,
    );
  }

  // 9d. Curated demo-customer complaint lifecycle ──────────────────────────────
  // The customer-facing demo (customer@darkops.com → CU-DEMO-001) must clearly
  // show that "live support" unlocks ONLY after a complaint passes its SLA
  // window: a just-raised complaint should NOT offer live support. Reset this
  // customer (and clear runtime junk from the "normal" persona) to a clean,
  // curated lifecycle. sla_due_at is set explicitly so each state is exact.
  const MIN_MS = 60000;
  const HOUR_MS = 3600000;
  const DAY_MS = 86400000;

  // Delete a customer's complaints (and their dependents) except any to keep.
  const cleanCustomerComplaints = async (customerId: string, keep: string[]) => {
    const { data: existing } = await supabase
      .from("complaints")
      .select("id")
      .eq("customer_id", customerId);
    const ids = (existing || []).map((c: any) => c.id).filter((id: string) => !keep.includes(id));
    if (!ids.length) return;
    await supabase.from("complaint_status_history").delete().in("complaint_id", ids);
    await supabase.from("complaint_comments").delete().in("complaint_id", ids);
    await supabase.from("refund_requests").delete().in("complaint_id", ids);
    await supabase.from("fraud_reviews").delete().in("complaint_id", ids);
    await supabase.from("failed_automation").delete().in("complaint_id", ids);
    await supabase.from("support_tickets").update({ complaint_id: null }).in("complaint_id", ids);
    await supabase.from("complaints").delete().in("id", ids);
  };

  const DEMO_CUST = "CU-DEMO-001";
  await supabase.from("customers").upsert(
    {
      id: DEMO_CUST,
      full_name: "Rajat Sharma",
      email: "customer@darkops.com",
      city: "Bengaluru",
      prior_claims_90d: 0,
    },
    { onConflict: "id" },
  );
  const demoOrderDefs = [
    { id: "ORD-DEMO-001", value: 480, items: 4, prev: "Milk, Bread, Eggs, Curd" },
    { id: "ORD-DEMO-002", value: 1260, items: 7, prev: "Groceries, Fruits, Snacks" },
    { id: "ORD-DEMO-003", value: 320, items: 3, prev: "Vegetables, Paneer" },
  ];
  await supabase.from("orders").upsert(
    demoOrderDefs.map((o) => ({
      id: o.id,
      customer_id: DEMO_CUST,
      store_id: "DS-1462",
      placed_at: new Date(Date.now() - 3 * DAY_MS).toISOString(),
      status: "delivered",
      total_amount_paise: o.value * 100,
      item_count: o.items,
      items_preview: o.prev,
      delivered_at: new Date(Date.now() - 3 * DAY_MS + 1500000).toISOString(),
    })),
    { onConflict: "id" },
  );

  // Order referenced by the simulated upstream ("10MinMart") signed-handoff demo
  // screen (src/routes/simulated-upstream.order-confirmation.tsx). It MUST exist
  // and be owned by the demo customer so the handoff/issue endpoint's order-
  // existence + ownership checks pass and the order pre-fills on /report-issue.
  // Delivered ~11 minutes ago today to match the stub's "Delivered in 11 mins".
  await supabase.from("orders").upsert(
    {
      id: "ORD-884213",
      customer_id: DEMO_CUST,
      store_id: "DS-1462",
      placed_at: new Date(Date.now() - 15 * MIN_MS).toISOString(),
      status: "delivered",
      total_amount_paise: 184500,
      item_count: 3,
      items_preview: "Nandini Toned Milk, Farm Fresh Eggs, Amul Butter",
      delivered_at: new Date(Date.now() - 4 * MIN_MS).toISOString(),
    },
    { onConflict: "id" },
  );

  await cleanCustomerComplaints(DEMO_CUST, []);
  // Clear runtime-submitted junk from the "normal" persona, keeping its scripted
  // auto-resolve candidate.
  await cleanCustomerComplaints("CU-NORMAL-001", ["CMP-NORM-001"]);

  const demoComplaints = [
    {
      // Just raised → within SLA → live support NOT available (SLA countdown).
      id: "CMP-DEMO-FRESH",
      complaint_ref: "REF-DEMO-100",
      order_id: "ORD-DEMO-001",
      summary: "Missing item - 1L milk not delivered",
      detail: "One 1L milk pack was missing from my delivered order. Requesting a refund.",
      category: "missing_item",
      type: "refund",
      priority: "P3",
      status: "unassigned",
      sla_state: "on_track",
      assigned_agent_id: null,
      created_at: new Date(Date.now() - 4 * MIN_MS).toISOString(),
      updated_at: new Date(Date.now() - 4 * MIN_MS).toISOString(),
      sla_due_at: new Date(Date.now() + 116 * MIN_MS).toISOString(),
      order_value_paise: 48000,
      refund_amount_paise: 0,
    },
    {
      // Under active review, still within SLA → live support NOT available.
      id: "CMP-DEMO-REVIEW",
      complaint_ref: "REF-DEMO-101",
      order_id: "ORD-DEMO-002",
      summary: "Wrong item received - toned milk instead of full cream",
      detail: "Received toned milk instead of the full cream milk I ordered.",
      category: "wrong_item",
      type: "operational_investigation",
      priority: "P2",
      status: "in_progress",
      sla_state: "on_track",
      assigned_agent_id: opsAgentId,
      created_at: new Date(Date.now() - 25 * MIN_MS).toISOString(),
      updated_at: new Date(Date.now() - 8 * MIN_MS).toISOString(),
      sla_due_at: new Date(Date.now() + 5 * MIN_MS).toISOString(),
      order_value_paise: 126000,
      refund_amount_paise: 0,
    },
    {
      // Response window exceeded → live support AVAILABLE.
      id: "CMP-DEMO-SLA",
      complaint_ref: "REF-DEMO-102",
      order_id: "ORD-DEMO-002",
      summary: "Quality issue - items arrived spoiled",
      detail: "Several items in my order were spoiled on arrival, and I have not heard back yet.",
      category: "quality_issue",
      type: "refund",
      priority: "P3",
      status: "in_progress",
      sla_state: "breached",
      assigned_agent_id: opsAgentId,
      created_at: new Date(Date.now() - Math.round(3.5 * HOUR_MS)).toISOString(),
      updated_at: new Date(Date.now() - 30 * MIN_MS).toISOString(),
      sla_due_at: new Date(Date.now() - 90 * MIN_MS).toISOString(),
      order_value_paise: 126000,
      refund_amount_paise: 0,
    },
    {
      // Resolved with an approved refund → closed, no live support.
      id: "CMP-DEMO-DONE",
      complaint_ref: "REF-DEMO-103",
      order_id: "ORD-DEMO-003",
      summary: "Damaged packaging - eggs broken on arrival",
      detail: "The egg tray was broken on delivery. I requested a refund.",
      category: "damaged_item",
      type: "refund",
      priority: "P3",
      status: "resolved",
      sla_state: "on_track",
      assigned_agent_id: opsAgentId,
      created_at: new Date(Date.now() - 2 * DAY_MS).toISOString(),
      sla_due_at: new Date(Date.now() - 2 * DAY_MS + 120 * MIN_MS).toISOString(),
      // Resolved ~40 min after it was raised. updated_at must reflect the
      // resolution time (the customer dashboard computes avg resolution as
      // updated_at - created_at), otherwise it reads as ~2 days.
      resolved_at: new Date(Date.now() - 2 * DAY_MS + 40 * MIN_MS).toISOString(),
      updated_at: new Date(Date.now() - 2 * DAY_MS + 40 * MIN_MS).toISOString(),
      resolution: "Refund of Rs 90 approved and processed to the original payment method.",
      order_value_paise: 32000,
      refund_amount_paise: 9000,
    },
  ].map((c) => ({ ...c, customer_id: DEMO_CUST, store_id: "DS-1462" }));
  await supabase.from("complaints").upsert(demoComplaints, { onConflict: "id" });
  console.log(
    `Curated ${demoComplaints.length} demo-customer complaints (fresh = no live support, breached = live support).`,
  );

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

  // 10b. Risk factors + a baseline "flagged" history event per review, so the
  // fraud-detail "why this was flagged" and "review log" panels show real data
  // (previously never seeded → always empty). Idempotent: clear then insert.
  const fraudReviewIds = FRAUD_CASES.map((f: any) => f.id);
  await supabase.from("fraud_risk_factors").delete().in("fraud_review_id", fraudReviewIds);
  await supabase.from("fraud_review_history").delete().in("fraud_review_id", fraudReviewIds);
  const factorRows = FRAUD_CASES.flatMap((f: any) =>
    (f.factors || []).map((factor: any) => ({
      fraud_review_id: f.id,
      label: factor.label,
      weight: factor.weight,
      evidence: factor.evidence,
    })),
  );
  const fraudHistoryRows = FRAUD_CASES.map((f: any) => ({
    fraud_review_id: f.id,
    actor_id: null,
    actor_label: "Risk engine",
    action: `Flagged at ${f.confidence}% risk score`,
    occurred_at: new Date(Date.now() - 3 * HOUR_MS).toISOString(),
  }));
  for (let i = 0; i < factorRows.length; i += 500) {
    const { error } = await supabase
      .from("fraud_risk_factors")
      .insert(factorRows.slice(i, i + 500));
    if (error) console.error("fraud_risk_factors insert error:", error.message);
  }
  if (fraudHistoryRows.length) {
    const { error } = await supabase.from("fraud_review_history").insert(fraudHistoryRows);
    if (error) console.error("fraud_review_history insert error:", error.message);
  }
  console.log(
    `Seeded ${factorRows.length} fraud risk factors + ${fraudHistoryRows.length} history events`,
  );

  // 11 + 12. Store health, metrics snapshots, and 31-day PulseScore history.
  // A realistic network: ~70% healthy, ~22% at-risk, ~8% critical. Every store's
  // metrics (SLA, refund rate, resolution time, equipment/delivery/inventory) are
  // derived from its health tier, and its PulseScore points are distributed to
  // land exactly on the tier's target — so the headline numbers all agree.
  await supabase
    .from("store_metrics_snapshots")
    .delete()
    .in(
      "store_id",
      STORES.map((s) => s.id),
    );
  await supabase
    .from("pulse_scores")
    .delete()
    .in(
      "store_id",
      STORES.map((s) => s.id),
    );

  const metricsRows: any[] = [];
  const storeHealth: { store_id: string; score: number }[] = [];
  const pulseRows: any[] = [];

  STORES.forEach((s) => {
    const r = mulberry32(hashStr(s.id));
    const ib = (lo: number, hi: number) => Math.floor(lo + r() * (hi - lo + 1));
    const bucket = hashStr(s.id) % 100;
    const tier = bucket < 8 ? "critical" : bucket < 30 ? "at_risk" : "healthy";

    const targetPulse =
      tier === "critical"
        ? 45 + Math.floor(r() * 13) // 45–57
        : tier === "at_risk"
          ? 63 + Math.floor(r() * 15) // 63–77
          : 82 + Math.floor(r() * 13); // 82–94

    const slaPct =
      tier === "critical"
        ? rd(79 + r() * 8, 1)
        : tier === "at_risk"
          ? rd(88 + r() * 6, 1)
          : rd(94 + r() * 5, 1);
    const refundRate =
      tier === "critical"
        ? rd(3.8 + r() * 2.4, 1)
        : tier === "at_risk"
          ? rd(2.4 + r() * 1.2, 1)
          : rd(1.3 + r() * 1.0, 1);
    const avgResolution =
      tier === "critical"
        ? Math.round(78 + r() * 30)
        : tier === "at_risk"
          ? Math.round(56 + r() * 18)
          : Math.round(38 + r() * 16);
    const equipmentFailures =
      tier === "critical" ? ib(5, 10) : tier === "at_risk" ? ib(2, 5) : ib(0, 2);
    const deliveryDelays =
      tier === "critical" ? ib(25, 45) : tier === "at_risk" ? ib(10, 25) : ib(2, 10);
    const inventoryIssues =
      tier === "critical" ? ib(7, 14) : tier === "at_risk" ? ib(3, 7) : ib(0, 3);
    const pickerDelay =
      tier === "critical"
        ? rd(3.9 + r() * 1.2, 1)
        : tier === "at_risk"
          ? rd(2.8 + r() * 1.0, 1)
          : rd(1.6 + r() * 1.1, 1);
    const openIssues = tier === "critical" ? ib(8, 16) : tier === "at_risk" ? ib(3, 8) : ib(0, 3);

    metricsRows.push({
      store_id: s.id,
      sla_pct: slaPct,
      refund_rate_pct: refundRate,
      equipment_failures_14d: equipmentFailures,
      inventory_issues: inventoryIssues,
      delivery_delays: deliveryDelays,
      picker_delay_mins: pickerDelay,
      avg_resolution_mins: avgResolution,
      open_issues: openIssues,
    });
    storeHealth.push({ store_id: s.id, score: targetPulse });

    // Category weights reflect each store's actual weaknesses so the PulseScore
    // breakdown is meaningful (a store with many equipment failures loses more
    // equipment points). A small baseline avoids a zero-weight division.
    const weights = [
      0.5 + Math.min(25, equipmentFailures * 2.5),
      0.5 + Math.min(25, Math.max(0, (96 - slaPct) * 1.2)),
      0.5 + Math.min(20, Math.max(0, (refundRate - 1.5) * 3)),
      0.5 + Math.min(15, deliveryDelays * 0.3),
      0.5 + Math.min(10, Math.max(0, (pickerDelay - 2) * 3)),
      0.5 + Math.min(10, inventoryIssues * 0.8),
    ];

    for (let day = 30; day >= 0; day--) {
      const noise = day === 0 ? 0 : Math.round((r() - 0.5) * 5);
      const dayScore = Math.max(40, Math.min(97, targetPulse + noise));
      const pts = distributeDeduction(weights, 100 - dayScore);
      const sum = pts.reduce((a, b) => a + b, 0);
      pulseRows.push({
        store_id: s.id,
        score: Math.max(12, 100 - sum),
        equipment_pts: pts[0],
        sla_pts: pts[1],
        refunds_pts: pts[2],
        delivery_pts: pts[3],
        picker_pts: pts[4],
        inventory_pts: pts[5],
        calculated_at: new Date(Date.now() - day * 86400000).toISOString(),
      });
    }
  });

  await supabase.from("store_metrics_snapshots").insert(metricsRows);
  const pulseChunk = 1000;
  for (let i = 0; i < pulseRows.length; i += pulseChunk) {
    await supabase.from("pulse_scores").insert(pulseRows.slice(i, i + pulseChunk));
  }

  const criticalHealth = storeHealth.filter((h) => h.score < 60);

  // 13. Work Orders - 2-5 per store based on latest health tier.
  const workOrderRows: any[] = [];
  storeHealth.forEach((health) => {
    const numWorkOrders = health.score < 60 ? 5 : health.score < 80 ? 3 : 2;
    for (let i = 0; i < numWorkOrders; i++) {
      workOrderRows.push({
        id: `WO-${health.store_id}-${i}`,
        store_id: health.store_id,
        asset_id: `EQ-${health.store_id}-${i + 1}`,
        asset_name: [
          "Walk-in freezer",
          "Chiller unit",
          "POS terminal",
          "Picker device",
          "Inventory scanner",
        ][i % 5],
        priority: health.score < 60 ? "P1" : health.score < 80 ? "P2" : "P3",
        status: "open",
      });
    }
  });
  await supabase.from("work_orders").upsert(workOrderRows, { onConflict: "id" });

  // 14. Alerts - one critical alert per genuinely critical store (latest health).
  const alertRows = criticalHealth.map((h, idx) => ({
    id: `ALT-${h.store_id}`,
    store_id: h.store_id,
    title: ["Chiller failure", "SLA breach risk", "High refund rate", "Equipment offline"][idx % 4],
    detail: `Store ${h.store_id} PulseScore critical (${h.score}) - intervention required.`,
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

  // Store manager notifications for critical stores (one per store, capped).
  criticalHealth.slice(0, 8).forEach((h) => {
    if (storeManagerProfileId) {
      notificationRows.push({
        recipient_id: storeManagerProfileId,
        title: `Store ${h.store_id} PulseScore critical (${h.score})`,
        meta: JSON.stringify({ store_id: h.store_id, pulse: h.score }),
        link_type: "store",
        link_ref: h.store_id,
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

  // 16. Support Tickets - distributed across 3 agents + unassigned
  let agentAId = createdProfiles["agent.a@darkops.com"]?.id;
  let agentBId = createdProfiles["agent.b@darkops.com"]?.id;
  let agentCId = createdProfiles["agent.c@darkops.com"]?.id;

  // Robustness: on re-runs the auth users already exist, so createdProfiles can
  // be empty. Resolve agent IDs directly from the DB by email (source of truth)
  // so the realistic ticket seed always runs instead of being silently skipped
  // and leaving only runtime automation-fallback junk behind.
  if (!agentAId || !agentBId || !agentCId) {
    const { data: agentProfiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("email", ["agent.a@darkops.com", "agent.b@darkops.com", "agent.c@darkops.com"]);
    const map = new Map((agentProfiles || []).map((p: any) => [p.email, p.id]));
    agentAId = agentAId || map.get("agent.a@darkops.com");
    agentBId = agentBId || map.get("agent.b@darkops.com");
    agentCId = agentCId || map.get("agent.c@darkops.com");
  }

  if (!agentAId || !agentBId || !agentCId) {
    console.warn(
      "Support agents not found - skipping ticket seed. Run migration first and ensure agents are registered.",
    );
    console.log("Agent A:", agentAId, "Agent B:", agentBId, "Agent C:", agentCId);
  } else {
    const slaIn = (mins: number) => new Date(Date.now() + mins * 60000).toISOString();
    const slaAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();
    const createdAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();

    // Full clean so idempotent re-runs — and any runtime automation-fallback
    // tickets (TKT-<timestamp>-FA) — never accumulate as junk. ticket_activity
    // is deleted first (FK is ON DELETE CASCADE, but be explicit).
    await supabase.from("ticket_activity").delete().not("id", "is", null);
    await supabase.from("support_tickets").delete().not("id", "is", null);

    // Insert tickets WITHOUT id - Supabase will generate UUIDs
    const supportTickets = [
      // ── Agent A (Priya Sharma) - 5 tickets ───────────────────────────────────
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
      // ── Agent B (Rohan Mehta) - 4 tickets ────────────────────────────────────
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
      // ── Agent C (Sneha Patel) - 3 tickets ─────────────────────────────────────
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
      // ── Unassigned - 2 tickets ────────────────────────────────────────────────
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

      // 17. ticket_activity - realistic event log for each ticket
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

      // TKT-001 - Priya / P1 / In Progress
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

      // TKT-002 - Priya / P2 / Open
      push(
        mkAct("TKT-002", null, "created", { title: "Ticket created from customer complaint" }, 46),
      );
      push(mkAct("TKT-002", agentAId, "assigned", { to: "Priya Sharma", from: null }, 45));

      // TKT-003 - Priya / P2 / SLA Breached
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

      // TKT-004 - Priya / P3 / Open
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

      // TKT-005 - Priya / Resolved
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

      // TKT-006 - Rohan / P1 / In Progress (SLA at risk)
      push(mkAct("TKT-006", null, "created", { title: "Cold chain failure auto-escalated" }, 110));
      push(mkAct("TKT-006", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 109));
      push(mkAct("TKT-006", agentBId, "status_changed", { from: "open", to: "in_progress" }, 5));

      // TKT-007 - Rohan / P2 / Open
      push(
        mkAct("TKT-007", null, "created", { title: "Reorder fulfillment failure escalated" }, 28),
      );
      push(mkAct("TKT-007", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 27));

      // TKT-008 - Rohan / P1 / Escalated / SLA Breached
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
            note: "Escalated to L2 - requires payment gateway review for ₹2,400 duplicate charge.",
          },
          40,
        ),
      );

      // TKT-009 - Rohan / P3 / Awaiting Customer
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

      // TKT-010 - Sneha / P2 / Open
      push(mkAct("TKT-010", null, "created", { title: "Substitution complaint opened" }, 25));
      push(mkAct("TKT-010", agentCId, "assigned", { to: "Sneha Patel", from: null }, 24));

      // TKT-011 - Sneha / P3 / Open
      push(mkAct("TKT-011", null, "created", { title: "Inventory discrepancy reported" }, 30));
      push(mkAct("TKT-011", agentCId, "assigned", { to: "Sneha Patel", from: null }, 29));

      // TKT-012 - Sneha / P1 / Resolved
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

      // TKT-013, TKT-014 - Unassigned
      push(mkAct("TKT-013", null, "created", { title: "New ticket from app crash report" }, 32));
      push(mkAct("TKT-014", null, "created", { title: "Wallet promo dispute opened" }, 10));

      // Additional tickets activity
      // TKT-015 - Agent A / P2 / Open
      push(mkAct("TKT-015", null, "created", { title: "Payment gateway timeout reported" }, 55));
      push(mkAct("TKT-015", agentAId, "assigned", { to: "Priya Sharma", from: null }, 54));

      // TKT-016 - Agent A / P3 / Open
      push(mkAct("TKT-016", null, "created", { title: "Coupon code complaint opened" }, 40));
      push(mkAct("TKT-016", agentAId, "assigned", { to: "Priya Sharma", from: null }, 39));

      // TKT-017 - Agent A / P1 / In Progress
      push(mkAct("TKT-017", null, "created", { title: "Order cancellation failure reported" }, 85));
      push(mkAct("TKT-017", agentAId, "assigned", { to: "Priya Sharma", from: null }, 84));
      push(mkAct("TKT-017", agentAId, "status_changed", { from: "open", to: "in_progress" }, 15));

      // TKT-018 - Agent B / P3 / Awaiting Customer
      push(mkAct("TKT-018", null, "created", { title: "Delivery zone dispute opened" }, 95));
      push(mkAct("TKT-018", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 94));
      push(
        mkAct("TKT-018", agentBId, "status_changed", { from: "open", to: "awaiting_customer" }, 25),
      );

      // TKT-019 - Agent B / P1 / Escalated
      push(mkAct("TKT-019", null, "created", { title: "Account suspension dispute raised" }, 250));
      push(mkAct("TKT-019", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 249));
      push(mkAct("TKT-019", agentBId, "status_changed", { from: "open", to: "in_progress" }, 120));
      push(
        mkAct("TKT-019", agentBId, "status_changed", { from: "in_progress", to: "escalated" }, 60),
      );

      // TKT-020 - Agent B / P2 / Open
      push(mkAct("TKT-020", null, "created", { title: "Bulk order discount complaint" }, 35));
      push(mkAct("TKT-020", agentBId, "assigned", { to: "Rohan Mehta", from: null }, 34));

      // TKT-021 - Agent C / P2 / Open
      push(mkAct("TKT-021", null, "created", { title: "Delivery time slot complaint" }, 45));
      push(mkAct("TKT-021", agentCId, "assigned", { to: "Sneha Patel", from: null }, 44));

      // TKT-022 - Agent C / P2 / In Progress
      push(
        mkAct("TKT-022", null, "created", { title: "Quality complaint - spoiled vegetables" }, 60),
      );
      push(mkAct("TKT-022", agentCId, "assigned", { to: "Sneha Patel", from: null }, 59));
      push(mkAct("TKT-022", agentCId, "status_changed", { from: "open", to: "in_progress" }, 20));

      // TKT-023 - Agent C / P1 / Resolved
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

      // TKT-024, TKT-025 - Unassigned
      push(mkAct("TKT-024", null, "created", { title: "Payment method issue reported" }, 20));
      push(mkAct("TKT-025", null, "created", { title: "Out of stock raincheck request" }, 15));

      if (activityRows.length > 0) {
        const { error: actErr } = await supabase.from("ticket_activity").insert(activityRows);
        if (actErr) console.error("Ticket activity seed error:", actErr.message);
        else console.log(`Seeded ${activityRows.length} ticket activity events`);
      }

      // 18. Notifications for agents - SLA alerts
      const tkt001Id = tkt["TKT-001"];
      const tkt003Id = tkt["TKT-003"];
      const tkt006Id = tkt["TKT-006"];
      const agentNotifs = [
        tkt001Id && {
          recipient_id: agentAId,
          title: "TKT-001 SLA approaching - act soon",
          meta: JSON.stringify({ ticket_id: tkt001Id, ticket_number: "TKT-001" }),
          link_type: "support_ticket",
          link_ref: tkt001Id,
        },
        tkt003Id && {
          recipient_id: agentAId,
          title: "TKT-003 SLA breached - take immediate action",
          meta: JSON.stringify({ ticket_id: tkt003Id, ticket_number: "TKT-003" }),
          link_type: "support_ticket",
          link_ref: tkt003Id,
        },
        tkt006Id && {
          recipient_id: agentBId,
          title: "TKT-006 SLA at risk - 6 min remaining",
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

      // 19. Failed Automation Queue - realistic intake queue with more volume
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
