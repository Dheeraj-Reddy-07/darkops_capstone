import { istClock } from "./format";
import { intBetween, pick, rngFor } from "./random";
import { STORES, type DarkStore } from "./stores";

export type Priority = "P1" | "P2" | "P3" | "P4";
export type CaseStatus =
  | "Unassigned"
  | "Assigned"
  | "In progress"
  | "Awaiting customer"
  | "Escalated — L2"
  | "Resolved";
export type SlaState = "on-track" | "at-risk" | "breached";
export type RouteKind = "Refund" | "Reorder" | "Operational investigation";

export interface Agent {
  id: string;
  name: string;
  hub: string;
  load: number;
  capacity: number;
}

export const AGENTS: Agent[] = [
  { id: "AG-0917", name: "A. Verma", hub: "Bengaluru", load: 198, capacity: 260 },
  { id: "AG-2041", name: "R. Iyer", hub: "Mumbai", load: 236, capacity: 280 },
  { id: "AG-1502", name: "K. Reddy", hub: "Hyderabad", load: 205, capacity: 240 },
  { id: "AG-2760", name: "M. Fernandes", hub: "Chennai", load: 139, capacity: 210 },
  { id: "AG-1188", name: "S. Qureshi", hub: "Delhi NCR", load: 142, capacity: 200 },
  { id: "AG-3304", name: "D. Bhatt", hub: "Night shift", load: 78, capacity: 150 },
];

export interface TimelineEvent {
  label: string;
  detail: string;
  at: string;
  state: "done" | "current" | "pending";
  tone?: "ok" | "warn" | "crit" | "info";
}

export interface CaseRecord {
  id: string;
  complaintId: string;
  summary: string;
  detail: string;
  storeId: string;
  storeName: string;
  city: string;
  priority: Priority;
  agentId: string | null;
  status: CaseStatus;
  sla: SlaState;
  slaDueIST: string;
  ageMins: number;
  customerName: string;
  customerId: string;
  orderId: string;
  orderValue: number;
  refundAmount: number;
  partner: string;
  partnerId: string;
  type: RouteKind;
  category: string;
  urgency: string;
  sentiment: string;
  qcScore: number;
  classifierConfidence: number;
  resolution: string;
  resolvedNote: string | null;
}

const COMPLAINTS: Array<{ summary: string; category: string; detail: string }> = [
  {
    summary: "Order delivered 46 min late",
    category: "Late delivery",
    detail:
      "Customer reports the order arrived 46 minutes past the promised window. Rider handover scan shows a 22 min dwell at the pack station.",
  },
  {
    summary: "Melted frozen goods on arrival",
    category: "Quality issue",
    detail:
      "Ice cream and frozen peas arrived thawed. Store freezer FRZ-08 logged 3h of downtime in the pick window.",
  },
  {
    summary: "Rider marked delivered, not received",
    category: "Missing item",
    detail:
      "Order marked delivered at the gate. Customer says nothing was handed over. POD photo is of a different door number.",
  },
  {
    summary: "Wrong item substituted",
    category: "Wrong item",
    detail:
      "Customer ordered toned milk 1L; store substituted full cream 500ml without approval on the substitution prompt.",
  },
  {
    summary: "Missing 2 of 9 items",
    category: "Missing item",
    detail:
      "Two SKUs missing from a 9-item basket. Pack station weight variance recorded at -640g.",
  },
  {
    summary: "Damaged packaging at handover",
    category: "Damaged item",
    detail: "Outer carton crushed; two glass jars cracked. Rider bag audit pending.",
  },
  {
    summary: "Expired product delivered",
    category: "Quality issue",
    detail: "Curd pack delivered 2 days past use-by date. Batch pulled for inventory audit.",
  },
  {
    summary: "Refund not credited after 5 days",
    category: "Payment issue",
    detail: "Refund approved on 24 Aug but not settled to source. Payment gateway reference pending.",
  },
  {
    summary: "Partial order cancelled at pack",
    category: "Missing item",
    detail: "3 of 11 lines cancelled at pack due to stockout; customer was not notified pre-dispatch.",
  },
  {
    summary: "Barcode mismatch at handover",
    category: "Wrong item",
    detail: "Scanner SCN-11 mismatch at handover; tote contents differ from the picklist.",
  },
];

const CUSTOMERS = [
  "Aditya M.",
  "Neha R.",
  "Faisal K.",
  "Priya S.",
  "Rahul D.",
  "Sneha V.",
  "Manish T.",
  "Kavya N.",
  "Ishaan G.",
  "Ritika B.",
  "Arjun P.",
  "Meera J.",
  "Zoya H.",
  "Vikram S.",
];

const PARTNERS = ["SwiftRiders", "MetroFleet", "GreenWheels", "RapidLast"];

const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P4"];
const STATUSES: CaseStatus[] = [
  "Unassigned",
  "Assigned",
  "In progress",
  "Awaiting customer",
  "Escalated — L2",
];

function build(): CaseRecord[] {
  const rand = rngFor("case-queue-v1");
  const pool: DarkStore[] = [...STORES].sort((a, b) => a.pulse - b.pulse).slice(0, 60);

  return Array.from({ length: 64 }, (_, i) => {
    const store = pool[Math.floor(rand() * pool.length)]!;
    const c = COMPLAINTS[i % COMPLAINTS.length]!;
    const priority = pick(rand, PRIORITIES);
    const status = i % 9 === 3 ? "Escalated — L2" : pick(rand, STATUSES);
    const agentId = status === "Unassigned" ? null : pick(rand, AGENTS).id;
    const ageMins = intBetween(rand, 12, 380);
    const sla: SlaState = ageMins > 240 ? "breached" : ageMins > 150 ? "at-risk" : "on-track";
    const orderValue = intBetween(rand, 180, 4200);
    const type: RouteKind =
      c.category === "Payment issue" || c.category === "Missing item"
        ? "Refund"
        : c.category === "Wrong item"
          ? "Reorder"
          : "Operational investigation";

    return {
      id: `CS-${4100 + i}`,
      complaintId: `CMP-${482000 + i * 137}`,
      summary: c.summary,
      detail: c.detail,
      storeId: store.id,
      storeName: store.name,
      city: store.city,
      priority,
      agentId,
      status,
      sla,
      slaDueIST: istClock(ageMins - 240),
      ageMins,
      customerName: pick(rand, CUSTOMERS),
      customerId: `CU-${intBetween(rand, 100000, 999999)}`,
      orderId: `ORD-${intBetween(rand, 700000, 999999)}`,
      orderValue,
      refundAmount: Math.round(orderValue * (0.3 + rand() * 0.7)),
      partner: pick(rand, PARTNERS),
      partnerId: `RD-${intBetween(rand, 1000, 9999)}`,
      type,
      category: c.category,
      urgency: priority === "P1" ? "Critical" : priority === "P2" ? "High" : "Standard",
      sentiment: rand() > 0.62 ? "Frustrated" : rand() > 0.3 ? "Neutral" : "Angry",
      qcScore: Math.round(72 + rand() * 26),
      classifierConfidence: Math.round(78 + rand() * 20),
      resolution:
        status === "Resolved"
          ? "Refund settled to source"
          : type === "Refund"
            ? "Refund pending risk review"
            : type === "Reorder"
              ? "Replacement dispatch pending"
              : "Field investigation open",
      resolvedNote: null,
    } satisfies CaseRecord;
  });
}

export const CASES: CaseRecord[] = build();
export const CASE_BY_ID = new Map(CASES.map((c) => [c.id, c]));

export function getCase(id: string) {
  return CASE_BY_ID.get(id);
}

export function agentById(id: string | null) {
  return AGENTS.find((a) => a.id === id) ?? null;
}

export const QUEUE_KPIS = {
  pending: 1342,
  escalated: 186,
  slaBreaches: 74,
  agentsAvailable: 138,
  agentsOnShift: 500,
  awaitingAssignment: 212,
  oldestWaitingMins: 47,
};

export const PRIORITY_MIX = [
  { name: "P1 Critical", value: 148, key: "P1" },
  { name: "P2 High", value: 386, key: "P2" },
  { name: "P3 Medium", value: 562, key: "P3" },
  { name: "P4 Low", value: 246, key: "P4" },
];

export const PENDING_STATUS_MIX = [
  { name: "Unassigned", value: 212 },
  { name: "Assigned", value: 466 },
  { name: "In progress", value: 532 },
  { name: "Awaiting customer", value: 132 },
];

export function caseTimeline(c: CaseRecord): TimelineEvent[] {
  const t = (mins: number) => `${istClock(mins)} IST`;
  const routed: TimelineEvent = {
    label: `Routed — ${c.type}`,
    detail:
      c.type === "Refund"
        ? `Refund of ₹${c.refundAmount.toLocaleString("en-IN")} queued for risk review`
        : c.type === "Reorder"
          ? "Replacement order queued at the origin dark store"
          : `Operational investigation opened against ${c.storeId}`,
    at: t(c.ageMins - 26),
    state: "done",
    tone: "info",
  };

  const events: TimelineEvent[] = [
    {
      label: "Complaint submitted",
      detail: `${c.customerName} (${c.customerId}) raised ${c.complaintId} on order ${c.orderId}`,
      at: t(c.ageMins),
      state: "done",
    },
    {
      label: "QC completed",
      detail: `Evidence verified · QC score ${c.qcScore}/100 · duplicate check passed`,
      at: t(c.ageMins - 6),
      state: "done",
      tone: "ok",
    },
    {
      label: "Classification completed",
      detail: `${c.category} · ${c.urgency} urgency · confidence ${c.classifierConfidence}%`,
      at: t(c.ageMins - 11),
      state: "done",
    },
    {
      label: "Unified case created",
      detail: `${c.id} opened against ${c.storeName} (${c.storeId})`,
      at: t(c.ageMins - 18),
      state: "done",
    },
    routed,
  ];

  if (c.type === "Refund") {
    events.push({
      label: "Fraud review",
      detail: "Held for manual decision in the Risk & Trust queue",
      at: t(c.ageMins - 34),
      state: c.status === "Resolved" ? "done" : "current",
      tone: "warn",
    });
  } else {
    events.push({
      label: c.type === "Reorder" ? "Auto resolution" : "Maintenance / operational fix",
      detail:
        c.type === "Reorder"
          ? "Replacement dispatched, awaiting delivery confirmation"
          : "Work order raised with the store engineering desk",
      at: t(c.ageMins - 34),
      state: c.status === "Resolved" ? "done" : "current",
      tone: "info",
    });
  }

  events.push({
    label: "Resolution",
    detail:
      c.status === "Resolved"
        ? c.resolution
        : `Pending — SLA deadline ${c.slaDueIST} IST`,
    at: c.status === "Resolved" ? t(c.ageMins - 60) : "—",
    state: c.status === "Resolved" ? "done" : "pending",
    tone: c.sla === "breached" ? "crit" : "info",
  });

  return events;
}
