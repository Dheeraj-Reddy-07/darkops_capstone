export interface InsightMetric {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "crit" | "neutral";
}

export interface InsightAnswer {
  question: string;
  answer: string;
  metrics: InsightMetric[];
  stores: Array<{ id: string; note: string }>;
  causes: string[];
  action: string;
  sources: string;
}

export const SUGGESTED_QUESTIONS = [
  "Why is Store DS-1462 declining?",
  "Which stores need intervention today?",
  "What is driving refund growth?",
  "Where are SLA breaches concentrated?",
  "Summarize today's network health.",
];

export const INSIGHTS: InsightAnswer[] = [
  {
    question: "Why is Store DS-1462 declining?",
    answer:
      "Kolkata Central DS lost 8 PulseScore points this week. The decline is cold-chain led: freezer FRZ-08 has been intermittently offline since 24 Aug, which pushed quality complaints and refunds up together.",
    metrics: [
      { label: "PulseScore", value: "31 / 100", tone: "crit" },
      { label: "SLA", value: "61.9%", tone: "crit" },
      { label: "Refund rate", value: "10.0%", tone: "crit" },
      { label: "Equipment deduction", value: "-18 pts", tone: "warn" },
    ],
    stores: [{ id: "DS-1462", note: "Kolkata Central DS · 4 open work orders" }],
    causes: [
      "Freezer FRZ-08 offline 3h+ per day across the last 6 days",
      "41 cold-chain complaints attributed to the store in 7 days",
      "Picker delay at 5.3m per order against a 2.5m target",
    ],
    action:
      "Escalate WO-77412 to same-day field service and divert frozen picks to Kolkata Riverside DS until the freezer clears QA.",
    sources: "PulseScore breakdown, work orders, complaint attribution - last 7 days",
  },
  {
    question: "Which stores need intervention today?",
    answer:
      "14 stores sit below PulseScore 60 with no active remediation plan. Five of them account for 38% of today's breached cases and should be staffed first.",
    metrics: [
      { label: "Stores < 60", value: "14 of 200", tone: "crit" },
      { label: "Breached cases today", value: "74", tone: "crit" },
      { label: "Network PulseScore", value: "78", tone: "warn" },
    ],
    stores: [
      { id: "DS-1462", note: "PulseScore 31 · cold chain" },
      { id: "DS-2162", note: "PulseScore 31 · equipment + SLA" },
      { id: "DS-1525", note: "PulseScore 32 · refund abuse cluster" },
      { id: "DS-1714", note: "PulseScore 32 · picker shortfall" },
      { id: "DS-1756", note: "PulseScore 32 · repeat missing-item claims" },
    ],
    causes: [
      "Equipment downtime is the largest single deduction across all five stores",
      "Two stores are running below 50% of rostered picker capacity",
    ],
    action:
      "Assign a regional ops lead per store for 72 hours and require a daily PulseScore review until each store clears 60.",
    sources: "Store network table, PulseScore breakdowns, live case queue",
  },
  {
    question: "What is driving refund growth?",
    answer:
      "Refund rate is 4.6% against a 4.0% target, up 0.7pts in 30 days. Growth is concentrated in cold-chain quality claims rather than a broad increase across categories.",
    metrics: [
      { label: "Refund rate", value: "4.6%", tone: "warn" },
      { label: "Target", value: "4.0%", tone: "neutral" },
      { label: "Flagged refund value", value: "₹18.4L", tone: "warn" },
      { label: "Repeat offenders", value: "63", tone: "crit" },
    ],
    stores: [
      { id: "DS-1714", note: "Refunds 10.1%" },
      { id: "DS-1462", note: "Refunds 10.0%" },
      { id: "DS-2162", note: "Refunds 9.6%" },
    ],
    causes: [
      "Cold-chain quality claims up 31% on stores with open freezer work orders",
      "946 claims are held pending risk decision, inflating the pending refund pool",
      "63 customers with 3+ upheld flags still auto-approve under the current threshold",
    ],
    action:
      "Lower the auto-approval ceiling to ₹500 for accounts with 2+ upheld flags and clear the 214 high-risk claims awaiting decision.",
    sources: "Refund ledger, Risk & Trust queue, store refund rates - last 30 days",
  },
  {
    question: "Where are SLA breaches concentrated?",
    answer:
      "SLA compliance is 91.4% against a 95% target. Breaches cluster in Mumbai and Kolkata evening shifts, where intake exceeds resolution capacity between 18:00 and 22:00 IST.",
    metrics: [
      { label: "SLA compliance", value: "91.4%", tone: "warn" },
      { label: "Breaches today", value: "74", tone: "crit" },
      { label: "Awaiting assignment", value: "212", tone: "warn" },
      { label: "Oldest unassigned", value: "47m", tone: "warn" },
    ],
    stores: [
      { id: "DS-2162", note: "SLA 57.3% - lowest in network" },
      { id: "DS-1525", note: "SLA 60.6%" },
      { id: "DS-1462", note: "SLA 61.9%" },
    ],
    causes: [
      "Mumbai hub is running at 236 of 280 assigned-case capacity",
      "212 cases are unassigned, the oldest waiting 47 minutes",
      "Night-shift roster is at 78 of 150 capacity",
    ],
    action:
      "Move 40 P3 cases from the Mumbai hub to the night shift and hold P1 auto-assignment to agents under 60% load.",
    sources: "Live case queue, agent workload by hub, SLA ledger - today",
  },
  {
    question: "Summarize today's network health.",
    answer:
      "The network is stable but declining. PulseScore is 78 (-3 in 30d), backlog is accumulating, and 14 stores need intervention. Nothing is at outage level, but refunds and cold chain both need a decision this week.",
    metrics: [
      { label: "Network PulseScore", value: "78", tone: "warn" },
      { label: "Open complaints", value: "8,214", tone: "warn" },
      { label: "SLA compliance", value: "91.4%", tone: "warn" },
      { label: "Avg resolution", value: "94m", tone: "warn" },
    ],
    stores: [
      { id: "DS-1462", note: "Worst PulseScore in network" },
      { id: "DS-2162", note: "Worst SLA in network" },
    ],
    causes: [
      "Intake has outpaced resolution every day since 21 Aug",
      "Equipment downtime is the largest PulseScore deduction network-wide",
      "Risk queue backlog is holding ₹18.4L of refund decisions",
    ],
    action:
      "Approve emergency field service for the 5 worst stores and add 40 agents to the evening shift for the next 7 days.",
    sources: "Executive KPI set, store network, risk queue - as of 21:40 IST",
  },
];

export function answerFor(question: string): InsightAnswer {
  const q = question.toLowerCase();
  const match =
    INSIGHTS.find((i) => i.question.toLowerCase() === q) ??
    INSIGHTS.find((i) =>
      i.question
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 4)
        .some((w) => q.includes(w)),
    );
  if (match) return match;
  return {
    question,
    answer:
      "No grounded answer is available for that question yet. This assistant only answers from the operational KPI set currently loaded - network health, store PulseScore, SLA, refunds and the risk queue.",
    metrics: [
      { label: "Network PulseScore", value: "78", tone: "warn" },
      { label: "Open complaints", value: "8,214", tone: "neutral" },
    ],
    stores: [],
    causes: [],
    action: "Try one of the suggested questions, or narrow the question to a store, city or KPI.",
    sources: "Executive KPI set - as of 21:40 IST",
  };
}
