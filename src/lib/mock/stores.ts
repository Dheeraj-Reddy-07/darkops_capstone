import { intBetween, pick, rngFor, round } from "./random";

export type StoreStatus = "critical" | "at-risk" | "healthy";

export interface PulseBreakdown {
  equipment: number;
  sla: number;
  refunds: number;
  delivery: number;
  picker: number;
  inventory: number;
}

export interface DarkStore {
  id: string;
  name: string;
  city: string;
  zone: string;
  manager: string;
  pulse: number;
  prevPulse: number;
  sla: number;
  refundRate: number;
  avgResolutionMins: number;
  openIssues: number;
  status: StoreStatus;
  pickers: number;
  riders: number;
  equipmentFailures14d: number;
  inventoryIssues: number;
  deliveryDelays: number;
  pickerDelayMins: number;
  breakdown: PulseBreakdown;
}

export const CITIES = [
  "Bengaluru",
  "Mumbai",
  "Delhi NCR",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Kochi",
  "Indore",
  "Surat",
  "Nagpur",
  "Chandigarh",
] as const;

const CITY_COUNTS: Record<string, number> = {
  Bengaluru: 24,
  Mumbai: 24,
  "Delhi NCR": 20,
  Hyderabad: 16,
  Chennai: 18,
  Kolkata: 14,
  Pune: 14,
  Ahmedabad: 12,
  Jaipur: 12,
  Kochi: 10,
  Indore: 10,
  Surat: 10,
  Nagpur: 8,
  Chandigarh: 8,
};

const ARCHETYPES = [
  "Central DS",
  "North DS",
  "South DS",
  "Ring Road DS",
  "Airport Road DS",
  "Old City DS",
  "Industrial Belt DS",
  "IT Corridor DS",
  "Riverside DS",
  "Outer Ring DS",
  "Tech Park DS",
  "Market Road DS",
  "Warehouse Zone DS",
  "Metro Depot DS",
  "East DS",
  "West DS",
  "Bypass DS",
  "Lake View DS",
  "Highway DS",
  "Station Road DS",
  "Sector 21 DS",
  "Expressway DS",
  "Civil Lines DS",
  "Port Road DS",
];

export const ZONES = ["North", "South", "East", "West", "Central"] as const;

const MANAGERS = [
  "S. Deshpande",
  "R. Iyer",
  "A. Verma",
  "M. Fernandes",
  "K. Reddy",
  "P. Nair",
  "N. Chatterjee",
  "V. Rathore",
  "T. Balakrishnan",
  "H. Shaikh",
  "D. Bhatia",
  "G. Kulkarni",
  "L. Menon",
  "J. Grewal",
  "B. Mahapatra",
  "C. Pillai",
];

/** Stores that appear by name in alerts, queues and the worst-store list. */
const OVERRIDES: Record<
  string,
  {
    id: string;
    manager?: string;
    breakdown: PulseBreakdown;
    sla: number;
    refundRate: number;
  }
> = {
  "Kolkata|Central DS": {
    id: "DS-1462",
    manager: "S. Deshpande",
    breakdown: { equipment: 18, sla: 23, refunds: 11, delivery: 9, picker: 5, inventory: 3 },
    sla: 61.9,
    refundRate: 10.0,
  },
  "Mumbai|Industrial Belt DS": {
    id: "DS-2162",
    manager: "M. Fernandes",
    breakdown: { equipment: 21, sla: 20, refunds: 10, delivery: 9, picker: 5, inventory: 4 },
    sla: 57.3,
    refundRate: 9.6,
  },
  "Bengaluru|Ring Road DS": {
    id: "DS-1525",
    manager: "K. Reddy",
    breakdown: { equipment: 0, sla: 0, refunds: 1, delivery: 0, picker: 2, inventory: 0 },
    sla: 100,
    refundRate: 0.5,
  },
  "Kochi|Airport Road DS": {
    id: "DS-1714",
    manager: "L. Menon",
    breakdown: { equipment: 11, sla: 20, refunds: 13, delivery: 13, picker: 7, inventory: 4 },
    sla: 61.4,
    refundRate: 10.1,
  },
  "Hyderabad|Old City DS": {
    id: "DS-1756",
    manager: "P. Nair",
    breakdown: { equipment: 14, sla: 19, refunds: 12, delivery: 11, picker: 6, inventory: 6 },
    sla: 64.0,
    refundRate: 9.5,
  },
  "Chennai|Old City DS": { id: "DS-1770", breakdown: { equipment: 6, sla: 9, refunds: 5, delivery: 5, picker: 3, inventory: 2 }, sla: 78.4, refundRate: 6.1 },
  "Chandigarh|North DS": { id: "DS-1070", breakdown: { equipment: 3, sla: 5, refunds: 3, delivery: 3, picker: 2, inventory: 1 }, sla: 91.2, refundRate: 4.1 },
  "Kolkata|Riverside DS": { id: "DS-2092", breakdown: { equipment: 8, sla: 11, refunds: 6, delivery: 6, picker: 3, inventory: 3 }, sla: 74.8, refundRate: 6.8 },
  "Hyderabad|South DS": { id: "DS-1126", breakdown: { equipment: 4, sla: 6, refunds: 4, delivery: 3, picker: 2, inventory: 2 }, sla: 88.5, refundRate: 4.4 },
  "Mumbai|North DS": { id: "DS-1007", breakdown: { equipment: 3, sla: 5, refunds: 3, delivery: 2, picker: 2, inventory: 1 }, sla: 92.6, refundRate: 3.8 },
  "Bengaluru|South DS": { id: "DS-1105", breakdown: { equipment: 2, sla: 4, refunds: 3, delivery: 2, picker: 1, inventory: 1 }, sla: 94.1, refundRate: 3.4 },
  "Bengaluru|Airport Road DS": { id: "DS-1630", breakdown: { equipment: 5, sla: 8, refunds: 4, delivery: 4, picker: 2, inventory: 2 }, sla: 82.3, refundRate: 5.2 },
  "Mumbai|Riverside DS": { id: "DS-2057", breakdown: { equipment: 7, sla: 10, refunds: 6, delivery: 5, picker: 3, inventory: 2 }, sla: 76.9, refundRate: 6.4 },
  "Hyderabad|Outer Ring DS": { id: "DS-1966", breakdown: { equipment: 9, sla: 12, refunds: 7, delivery: 7, picker: 4, inventory: 3 }, sla: 71.5, refundRate: 7.3 },
  "Delhi NCR|Outer Ring DS": { id: "DS-1959", breakdown: { equipment: 6, sla: 9, refunds: 6, delivery: 5, picker: 3, inventory: 2 }, sla: 79.2, refundRate: 5.9 },
  "Delhi NCR|Industrial Belt DS": { id: "DS-2169", breakdown: { equipment: 10, sla: 13, refunds: 7, delivery: 6, picker: 4, inventory: 3 }, sla: 69.4, refundRate: 7.7 },
  "Hyderabad|IT Corridor DS": { id: "DS-1861", breakdown: { equipment: 4, sla: 7, refunds: 4, delivery: 3, picker: 2, inventory: 2 }, sla: 86.7, refundRate: 4.7 },
};

function statusFor(pulse: number): StoreStatus {
  if (pulse < 60) return "critical";
  if (pulse < 80) return "at-risk";
  return "healthy";
}

function build(): DarkStore[] {
  const stores: DarkStore[] = [];
  const usedIds = new Set(Object.values(OVERRIDES).map((o) => o.id));

  for (const city of CITIES) {
    const count = CITY_COUNTS[city] ?? 10;
    for (let i = 0; i < count; i++) {
      const archetype = ARCHETYPES[i % ARCHETYPES.length]!;
      const key = `${city}|${archetype}`;
      const rand = rngFor(key);
      const override = OVERRIDES[key];

      let id = override?.id;
      if (!id) {
        let candidate = "";
        do {
          candidate = `DS-${intBetween(rand, 1000, 2199)}`;
        } while (usedIds.has(candidate));
        id = candidate;
      }
      usedIds.add(id);

      const breakdown: PulseBreakdown =
        override?.breakdown ??
        (() => {
          const severity = rand();
          const scale = severity > 0.86 ? 2.4 : severity > 0.6 ? 1.5 : 0.75;
          return {
            equipment: Math.round(intBetween(rand, 1, 7) * scale),
            sla: Math.round(intBetween(rand, 2, 9) * scale),
            refunds: Math.round(intBetween(rand, 1, 6) * scale),
            delivery: Math.round(intBetween(rand, 1, 5) * scale),
            picker: Math.round(intBetween(rand, 1, 3) * scale),
            inventory: Math.round(intBetween(rand, 1, 3) * scale),
          };
        })();

      const deduction =
        breakdown.equipment +
        breakdown.sla +
        breakdown.refunds +
        breakdown.delivery +
        breakdown.picker +
        breakdown.inventory;
      const pulse = Math.max(12, 100 - deduction);
      const sla = override?.sla ?? round(Math.max(52, 98 - deduction * 0.72 - rand() * 4), 1);
      const refundRate = override?.refundRate ?? round(2.4 + deduction * 0.11 + rand() * 0.8, 1);

      stores.push({
        id,
        name: `${city === "Delhi NCR" ? "Delhi NCR" : city} ${archetype}`,
        city,
        zone: pick(rand, ZONES),
        manager: override?.manager ?? pick(rand, MANAGERS),
        pulse,
        prevPulse: pulse + intBetween(rand, -3, 9),
        sla,
        refundRate,
        avgResolutionMins: Math.round(62 + deduction * 1.1 + rand() * 18),
        openIssues: Math.round(4 + deduction * 0.9 + rand() * 12),
        status: statusFor(pulse),
        pickers: intBetween(rand, 8, 22),
        riders: intBetween(rand, 4, 14),
        equipmentFailures14d: Math.max(0, Math.round(breakdown.equipment * 0.58)),
        inventoryIssues: Math.round(breakdown.inventory * 2.9 + 2),
        deliveryDelays: Math.round(breakdown.delivery * 10 + intBetween(rand, 2, 14)),
        pickerDelayMins: round(1.4 + breakdown.picker * 0.78, 1),
        breakdown,
      });
    }
  }
  return stores;
}

export const STORES: DarkStore[] = build();

export const STORE_BY_ID = new Map(STORES.map((s) => [s.id, s]));

export function getStore(id: string) {
  return STORE_BY_ID.get(id);
}

export const NETWORK = {
  storeCount: STORES.length,
  cityCount: CITIES.length,
  avgPulse: Math.round(STORES.reduce((a, s) => a + s.pulse, 0) / STORES.length),
  criticalStores: STORES.filter((s) => s.status === "critical").length,
  avgSla: round(STORES.reduce((a, s) => a + s.sla, 0) / STORES.length, 1),
  avgRefundRate: round(STORES.reduce((a, s) => a + s.refundRate, 0) / STORES.length, 1),
  avgResolution: Math.round(
    STORES.reduce((a, s) => a + s.avgResolutionMins, 0) / STORES.length,
  ),
};

export const WORST_STORES = [...STORES].sort((a, b) => a.pulse - b.pulse).slice(0, 5);

export function storesByCity(city: string) {
  return STORES.filter((s) => s.city === city);
}

/** 14-day series used by the store detail charts. */
export function storeSeries(store: DarkStore) {
  const rand = rngFor(`series-${store.id}`);
  return Array.from({ length: 14 }, (_, i) => {
    const day = 16 + i;
    return {
      day: `${day} Aug`,
      failures: Math.max(0, Math.round(store.breakdown.equipment * 0.3 * rand() + rand() * 3)),
      downtime: round(rand() * (1 + store.breakdown.equipment * 0.25), 1),
      stockouts: Math.round(4 + rand() * store.breakdown.inventory * 3),
      mismatches: Math.round(2 + rand() * store.breakdown.inventory * 2.2),
    };
  });
}

export function pulseTrend(store: DarkStore, days: number) {
  const rand = rngFor(`trend-${store.id}-${days}`);
  const start = store.prevPulse;
  return Array.from({ length: days }, (_, i) => ({
    t: i,
    label: `D-${days - i}`,
    score: Math.round(
      start + ((store.pulse - start) * i) / (days - 1) + (rand() - 0.5) * 4,
    ),
  }));
}
