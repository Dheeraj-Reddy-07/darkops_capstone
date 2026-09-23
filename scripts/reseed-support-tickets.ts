import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * Surgical, DB-driven reseed of the support workspace.
 *
 * - Resolves the real support agent / lead profile IDs from the DB by email
 *   (robust to auth-user re-creation, which is why the main seed's ticket
 *   section was silently skipped and left only runtime junk behind).
 * - Wipes ALL existing support tickets + activity (removes the accumulated
 *   `TKT-<timestamp>-FA` automation-fallback junk).
 * - Inserts a realistic, well-distributed, TIME-RELATIVE set of tickets so SLA
 *   states (on-track / at-risk / breached) stay meaningful whenever it is run.
 *
 * Nothing is hardcoded in the app; this only writes rows to the database, which
 * the app then reads.
 */

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

type SlaState = "on_track" | "at_risk" | "breached" | "resolved";

// SLA deadline offset (ms from now) for a desired display state. Breaches are
// realistic (minutes to a few hours), never multi-day.
function slaDeadline(state: SlaState, seed: number): number | null {
  if (state === "resolved") return null;
  if (state === "on_track") return now + (60 + (seed % 5) * 45) * MIN; // 1h – ~4h ahead
  if (state === "at_risk") return now + (6 + (seed % 4) * 5) * MIN; // 6 – 21 min ahead
  return now - (10 + (seed % 6) * 25) * MIN; // 10 min – ~2.3h ago
}

interface Spec {
  n: number; // ticket number suffix
  title: string;
  category: string;
  queue: "refunds" | "general" | "operational" | "reorders";
  priority: "P1" | "P2" | "P3";
  status: "open" | "in_progress" | "awaiting_customer" | "escalated" | "resolved";
  assignee: "A" | "B" | "C" | "LEAD" | null;
  sla: SlaState;
  ageMins: number; // created this many minutes ago
  resolutionNote?: string;
  resolutionMins?: number;
}

// Realistic dark-store support caseload. Distribution:
//   Priya(A) 6, Rohan(B) 5, Sneha(C) 4, Lead 3, Unassigned pool 4, + resolved history
const SPECS: Spec[] = [
  // ── Priya Sharma (A) ──────────────────────────────────────────────
  {
    n: 1001,
    title: "Duplicate refund claim needs validation - ORD-884213",
    category: "payment_issue",
    queue: "refunds",
    priority: "P1",
    status: "in_progress",
    assignee: "A",
    sla: "at_risk",
    ageMins: 40,
  },
  {
    n: 1002,
    title: "Missing item - 1L Amul milk not in delivered order",
    category: "missing_item",
    queue: "general",
    priority: "P2",
    status: "open",
    assignee: "A",
    sla: "on_track",
    ageMins: 55,
  },
  {
    n: 1003,
    title: "Late delivery - order arrived 47 mins past ETA",
    category: "late_delivery",
    queue: "operational",
    priority: "P2",
    status: "open",
    assignee: "A",
    sla: "breached",
    ageMins: 150,
  },
  {
    n: 1004,
    title: "Wrong items packed - customer received another order",
    category: "wrong_item",
    queue: "general",
    priority: "P3",
    status: "awaiting_customer",
    assignee: "A",
    sla: "on_track",
    ageMins: 30,
  },
  {
    n: 1005,
    title: "Damaged packaging - eggs broken on arrival",
    category: "damaged_item",
    queue: "refunds",
    priority: "P3",
    status: "open",
    assignee: "A",
    sla: "on_track",
    ageMins: 18,
  },
  {
    n: 1006,
    title: "Refund processed - spoiled paneer, Rs 120 returned",
    category: "quality_issue",
    queue: "refunds",
    priority: "P3",
    status: "resolved",
    assignee: "A",
    sla: "resolved",
    ageMins: 300,
    resolutionNote:
      "Verified spoilage from evidence photo. Refund of Rs 120 approved to original payment method. Customer notified.",
    resolutionMins: 145,
  },

  // ── Rohan Mehta (B) ───────────────────────────────────────────────
  {
    n: 1007,
    title: "Cold chain failure - yogurt expired on delivery",
    category: "quality_issue",
    queue: "operational",
    priority: "P1",
    status: "escalated",
    assignee: "B",
    sla: "breached",
    ageMins: 120,
  },
  {
    n: 1008,
    title: "Partial order - 2 of 6 items missing",
    category: "missing_item",
    queue: "general",
    priority: "P2",
    status: "in_progress",
    assignee: "B",
    sla: "at_risk",
    ageMins: 65,
  },
  {
    n: 1009,
    title: "Payment deducted twice on UPI transaction",
    category: "payment_issue",
    queue: "refunds",
    priority: "P2",
    status: "open",
    assignee: "B",
    sla: "on_track",
    ageMins: 25,
  },
  {
    n: 1010,
    title: "Reorder request - replacement for damaged bread",
    category: "damaged_item",
    queue: "reorders",
    priority: "P3",
    status: "open",
    assignee: "B",
    sla: "on_track",
    ageMins: 12,
  },
  {
    n: 1011,
    title: "Refund confirmed - missing cooking oil, Rs 160",
    category: "missing_item",
    queue: "refunds",
    priority: "P3",
    status: "resolved",
    assignee: "B",
    sla: "resolved",
    ageMins: 420,
    resolutionNote:
      "Confirmed item not scanned at packing. Refund of Rs 160 issued. Store notified to recheck picker station.",
    resolutionMins: 95,
  },

  // ── Sneha Patel (C) ───────────────────────────────────────────────
  {
    n: 1012,
    title: "Quality issue - stale bread past best-before date",
    category: "quality_issue",
    queue: "operational",
    priority: "P2",
    status: "open",
    assignee: "C",
    sla: "breached",
    ageMins: 95,
  },
  {
    n: 1013,
    title: "Missing item - Farm Fresh eggs x12 not delivered",
    category: "missing_item",
    queue: "general",
    priority: "P3",
    status: "in_progress",
    assignee: "C",
    sla: "on_track",
    ageMins: 40,
  },
  {
    n: 1014,
    title: "Wrong item - received toned milk instead of full cream",
    category: "wrong_item",
    queue: "general",
    priority: "P3",
    status: "awaiting_customer",
    assignee: "C",
    sla: "on_track",
    ageMins: 22,
  },
  {
    n: 1015,
    title: "Late delivery refund - 35 min SLA breach",
    category: "late_delivery",
    queue: "refunds",
    priority: "P3",
    status: "resolved",
    assignee: "C",
    sla: "resolved",
    ageMins: 260,
    resolutionNote:
      "Delivery delay confirmed against rider GPS log. Goodwill credit of Rs 50 applied.",
    resolutionMins: 70,
  },

  // ── Support Lead (own queue) ──────────────────────────────────────
  {
    n: 1016,
    title: "Escalated: repeated cold-chain complaints from DS-1105",
    category: "quality_issue",
    queue: "operational",
    priority: "P1",
    status: "escalated",
    assignee: "LEAD",
    sla: "breached",
    ageMins: 80,
  },
  {
    n: 1017,
    title: "High-value refund review - Rs 1,840 order dispute",
    category: "payment_issue",
    queue: "refunds",
    priority: "P2",
    status: "in_progress",
    assignee: "LEAD",
    sla: "at_risk",
    ageMins: 50,
  },
  {
    n: 1018,
    title: "Customer follow-up - satisfaction check on prior refund",
    category: "other",
    queue: "general",
    priority: "P3",
    status: "awaiting_customer",
    assignee: "LEAD",
    sla: "on_track",
    ageMins: 35,
  },

  // ── Unassigned pool ───────────────────────────────────────────────
  {
    n: 1019,
    title: "New: missing item report - ORD-882117",
    category: "missing_item",
    queue: "general",
    priority: "P2",
    status: "open",
    assignee: null,
    sla: "on_track",
    ageMins: 8,
  },
  {
    n: 1020,
    title: "New: damaged item on delivery - awaiting triage",
    category: "damaged_item",
    queue: "refunds",
    priority: "P3",
    status: "open",
    assignee: null,
    sla: "on_track",
    ageMins: 5,
  },
  {
    n: 1021,
    title: "New: late delivery complaint - needs assignment",
    category: "late_delivery",
    queue: "operational",
    priority: "P2",
    status: "open",
    assignee: null,
    sla: "at_risk",
    ageMins: 20,
  },
  {
    n: 1022,
    title: "New: payment issue - double charge reported",
    category: "payment_issue",
    queue: "refunds",
    priority: "P1",
    status: "open",
    assignee: null,
    sla: "breached",
    ageMins: 45,
  },
];

async function main() {
  // 1) Resolve real support identities from the DB (source of truth).
  const emails = [
    "support@darkops.com",
    "agent.a@darkops.com",
    "agent.b@darkops.com",
    "agent.c@darkops.com",
  ];
  const { data: profs, error: pErr } = await db
    .from("profiles")
    .select("id, email, full_name")
    .in("email", emails);
  if (pErr) throw pErr;

  const byEmail = new Map((profs || []).map((p) => [p.email, p]));
  const ids = {
    LEAD: byEmail.get("support@darkops.com")?.id,
    A: byEmail.get("agent.a@darkops.com")?.id,
    B: byEmail.get("agent.b@darkops.com")?.id,
    C: byEmail.get("agent.c@darkops.com")?.id,
  };
  const missing = Object.entries(ids)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Missing support profiles for: ${missing.join(", ")}. Run the main seed first to create agents.`,
    );
  }
  console.log(
    "Resolved support identities:",
    Object.fromEntries(emails.map((e) => [e, byEmail.get(e)?.id])),
  );

  // 2) Link a few tickets to real complaints (for ticket-detail context).
  const { data: complaints } = await db
    .from("complaints")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(SPECS.length);
  const complaintIds = (complaints || []).map((c) => c.id);

  // 3) Wipe ALL existing tickets (cascades ticket_activity). Removes -FA junk.
  const { data: existing } = await db.from("support_tickets").select("id");
  const existingCount = existing?.length || 0;
  // ticket_activity FK is ON DELETE CASCADE, but delete it explicitly first in
  // case cascade is not present in a given environment.
  await db.from("ticket_activity").delete().not("id", "is", null);
  await db.from("support_tickets").delete().not("id", "is", null);
  console.log(`Deleted ${existingCount} existing tickets (and their activity).`);

  // 4) Build realistic ticket rows.
  const assigneeId = (a: Spec["assignee"]) => (a ? (ids as any)[a] : null);
  const rows = SPECS.map((s, i) => {
    const createdMs = now - s.ageMins * MIN;
    const sla = slaDeadline(s.sla, s.n);
    const resolvedBy = s.status === "resolved" ? assigneeId(s.assignee) : null;
    return {
      ticket_number: `TKT-${s.n}`,
      title: s.title,
      complaint_id: complaintIds[i] || null,
      assigned_to: assigneeId(s.assignee),
      created_by: assigneeId(s.assignee) || ids.LEAD,
      resolved_by: resolvedBy,
      status: s.status,
      priority: s.priority,
      queue: s.queue,
      sla_deadline: sla ? iso(sla) : null,
      created_at: iso(createdMs),
      updated_at: iso(
        s.status === "resolved" ? createdMs + (s.resolutionMins || 60) * MIN : now - 5 * MIN,
      ),
      resolution_notes: s.resolutionNote || null,
      resolution_time_minutes: s.resolutionMins || null,
      __spec: s, // stripped before insert
    };
  });
  const insertRows = rows.map(({ __spec, ...r }) => r);

  const { data: inserted, error: iErr } = await db
    .from("support_tickets")
    .insert(insertRows)
    .select("id, ticket_number, assigned_to, status");
  if (iErr) throw iErr;
  console.log(`Inserted ${inserted?.length} realistic tickets.`);

  // 5) Realistic activity trail per ticket.
  const byNumber = new Map((inserted || []).map((t) => [t.ticket_number, t]));
  const activity: any[] = [];
  for (const r of rows) {
    const t = byNumber.get(r.ticket_number);
    if (!t) continue;
    const s = r.__spec;
    const createdMs = now - s.ageMins * MIN;
    activity.push({
      ticket_id: t.id,
      actor_id: r.created_by,
      event_type: "created",
      payload: { category: s.category, queue: s.queue, priority: s.priority },
      created_at: iso(createdMs),
    });
    if (r.assigned_to) {
      activity.push({
        ticket_id: t.id,
        actor_id: ids.LEAD,
        event_type: "assigned",
        payload: { assigned_to: r.assigned_to },
        created_at: iso(createdMs + 3 * MIN),
      });
    }
    if (["in_progress", "escalated", "awaiting_customer"].includes(s.status)) {
      activity.push({
        ticket_id: t.id,
        actor_id: r.assigned_to,
        event_type: "status_changed",
        payload: { to: s.status },
        created_at: iso(createdMs + 8 * MIN),
      });
    }
    if (s.status === "resolved") {
      activity.push({
        ticket_id: t.id,
        actor_id: r.resolved_by,
        event_type: "resolved",
        payload: { note: s.resolutionNote },
        created_at: iso(createdMs + (s.resolutionMins || 60) * MIN),
      });
    }
  }
  const { error: aErr } = await db.from("ticket_activity").insert(activity);
  if (aErr) throw aErr;
  console.log(`Inserted ${activity.length} activity events.`);

  console.log("\n✅ Support workspace reseeded with realistic, time-relative data.");
}

main().catch((e) => {
  console.error("RESEED FAILED:", e.message || e);
  process.exit(1);
});
