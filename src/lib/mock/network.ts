import { rngFor, round } from "./random";
import { CITIES, STORES, NETWORK, WORST_STORES } from "./stores";

export const EXEC_KPIS = {
  networkPulse: 78,
  pulseDelta: -3,
  openComplaints: 8214,
  openComplaintsDelta: 6.2,
  slaCompliance: 91.4,
  slaDelta: -1.8,
  slaTarget: 95,
  avgResolutionMins: 94,
  resolutionDelta: -7,
  resolutionTarget: 90,
  refundRate: 4.6,
  refundDelta: 0.7,
  refundTarget: 4.0,
  criticalStores: NETWORK.criticalStores,
  criticalDelta: 3,
  complaints24h: 8214,
};

export const VOLUME_SERIES = (() => {
  const rand = rngFor("volume-30d");
  return Array.from({ length: 30 }, (_, i) => {
    const base = 6900 + Math.sin(i / 2.6) * 620 + i * 24;
    const raised = Math.round(base + rand() * 500);
    return {
      day: `${String(1 + i).padStart(2, "0")} Aug`,
      raised,
      resolved: Math.round(raised - 90 - rand() * 380),
    };
  });
})();

export const BACKLOG_DELTA = VOLUME_SERIES.reduce((a, d) => a + (d.raised - d.resolved), 0);

export interface RedAlert {
  id: string;
  title: string;
  detail: string;
  ago: string;
  severity: "crit" | "warn";
  storeId: string;
}

export const RED_ALERTS: RedAlert[] = [
  {
    id: "ALT-48219",
    title: "Store DS-1462 PulseScore dropped",
    detail: "Kolkata Central DS · PulseScore 31 · freezer FRZ-08 down, 41 cold-chain claims",
    ago: "18m ago",
    severity: "crit",
    storeId: "DS-1462",
  },
  {
    id: "ALT-48217",
    title: "Cold chain failure",
    detail: "Mumbai Industrial Belt DS · Freezer FRZ-08 offline 3h",
    ago: "52m ago",
    severity: "crit",
    storeId: "DS-2162",
  },
  {
    id: "ALT-48214",
    title: "Refund rate spike",
    detail: "Bengaluru Ring Road DS · Refunds 9.2% vs 4.0% target",
    ago: "1h 20m ago",
    severity: "crit",
    storeId: "DS-1525",
  },
  {
    id: "ALT-48208",
    title: "Picker capacity shortfall",
    detail: "Kochi Airport Road DS · 6 of 14 pickers on shift",
    ago: "2h ago",
    severity: "warn",
    storeId: "DS-1714",
  },
  {
    id: "ALT-48203",
    title: "Repeat missing-item claims",
    detail: "Hyderabad Old City DS · 23 claims from 9 customers",
    ago: "3h 10m ago",
    severity: "warn",
    storeId: "DS-1756",
  },
];

export const CITY_STATS = CITIES.map((city) => {
  const stores = STORES.filter((s) => s.city === city);
  const rand = rngFor(`city-${city}`);
  const complaints = Math.round(stores.length * (180 + rand() * 90));
  return {
    city,
    complaints,
    sla: round(stores.reduce((a, s) => a + s.sla, 0) / stores.length, 1),
    stores: stores.length,
  };
}).sort((a, b) => b.complaints - a.complaints);

export { WORST_STORES, NETWORK };

export const NOTIFICATIONS = [
  { id: "ALT-48219", title: "DS-1462 PulseScore dropped to 31", meta: "Kolkata Central DS · 18m ago", to: "store" as const, ref: "DS-1462" },
  { id: "ALT-48217", title: "Cold chain failure at DS-2162", meta: "Mumbai Industrial Belt DS · 52m ago", to: "store" as const, ref: "DS-2162" },
  { id: "ALT-48214", title: "Refund rate spike at DS-1525", meta: "Bengaluru Ring Road DS · 1h 20m ago", to: "store" as const, ref: "DS-1525" },
  { id: "ALT-48211", title: "74 SLA breaches recorded today", meta: "Operations queue · 2h ago", to: "operations" as const, ref: "" },
  { id: "ALT-48205", title: "214 complaints awaiting risk decision", meta: "Risk & Trust queue · 3h ago", to: "fraud" as const, ref: "" },
];
