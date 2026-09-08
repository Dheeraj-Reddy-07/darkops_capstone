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
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 61.9,
    refundRate: 10.0,
  },
  "Mumbai|Industrial Belt DS": {
    id: "DS-2162",
    manager: "M. Fernandes",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 57.3,
    refundRate: 9.6,
  },
  "Bengaluru|Ring Road DS": {
    id: "DS-1525",
    manager: "K. Reddy",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 100,
    refundRate: 0.5,
  },
  "Kochi|Airport Road DS": {
    id: "DS-1714",
    manager: "L. Menon",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 61.4,
    refundRate: 10.1,
  },
  "Hyderabad|Old City DS": {
    id: "DS-1756",
    manager: "P. Nair",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 64.0,
    refundRate: 9.5,
  },
  "Chennai|Old City DS": {
    id: "DS-1770",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 78.4,
    refundRate: 6.1,
  },
  "Chandigarh|North DS": {
    id: "DS-1070",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 91.2,
    refundRate: 4.1,
  },
  "Kolkata|Riverside DS": {
    id: "DS-2092",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 74.8,
    refundRate: 6.8,
  },
  "Hyderabad|South DS": {
    id: "DS-1126",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 88.5,
    refundRate: 4.4,
  },
  "Mumbai|North DS": {
    id: "DS-1007",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 92.6,
    refundRate: 3.8,
  },
  "Bengaluru|South DS": {
    id: "DS-1105",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 94.1,
    refundRate: 3.4,
  },
  "Bengaluru|Airport Road DS": {
    id: "DS-1630",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 82.3,
    refundRate: 5.2,
  },
  "Mumbai|Riverside DS": {
    id: "DS-2057",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 76.9,
    refundRate: 6.4,
  },
  "Hyderabad|Outer Ring DS": {
    id: "DS-1966",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 71.5,
    refundRate: 7.3,
  },
  "Delhi NCR|Outer Ring DS": {
    id: "DS-1959",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 79.2,
    refundRate: 5.9,
  },
  "Delhi NCR|Industrial Belt DS": {
    id: "DS-2169",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 69.4,
    refundRate: 7.7,
  },
  "Hyderabad|IT Corridor DS": {
    id: "DS-1861",
    breakdown: { equipment: 0, sla: 0, refunds: 0, delivery: 0, picker: 0, inventory: 0 },
    sla: 86.7,
    refundRate: 4.7,
  },
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
            equipment: 0, // Will be calculated from metrics
            sla: 0, // Will be calculated from metrics
            refunds: 0, // Will be calculated from metrics
            delivery: 0, // Will be calculated from metrics
            picker: 0, // Will be calculated from metrics
            inventory: 0, // Will be calculated from metrics
          };
        })();

      // Generate realistic metrics first
      const severity = rand();
      const scale = severity > 0.86 ? 2.4 : severity > 0.6 ? 1.5 : 0.75;
      const equipmentFailures14d = Math.max(0, Math.round(intBetween(rand, 0, 10) * scale));
      const slaPct =
        override?.sla ?? round(Math.max(70, 98 - intBetween(rand, 0, 30) - rand() * 4), 1);
      const refundRatePct =
        override?.refundRate ?? round(2 + intBetween(rand, 0, 8) * scale + rand() * 0.8, 1);
      const deliveryDelays = Math.max(0, Math.round(intBetween(rand, 0, 50) * scale));
      const pickerDelayMins = round(1.5 + intBetween(rand, 0, 5) * scale, 1);
      const inventoryIssues = Math.max(0, Math.round(intBetween(rand, 0, 15) * scale));
      const avgResolutionMins = Math.round(30 + intBetween(rand, 10, 120) * scale);
      const openIssues = Math.max(0, Math.round(2 + intBetween(rand, 0, 20) * scale));

      // Calculate pulse from metrics using the same formula as seed.ts
      const equipmentPts = Math.min(30, equipmentFailures14d * 3);
      const slaPts = Math.max(0, (95 - slaPct) * 0.5);
      const refundsPts = Math.max(0, (refundRatePct - 2) * 1);
      const deliveryPts = Math.min(20, deliveryDelays * 0.5);
      const pickerPts = Math.max(0, (pickerDelayMins - 2.5) * 2);
      const inventoryPts = Math.min(15, inventoryIssues * 1);
      const totalDeduction =
        equipmentPts + slaPts + refundsPts + deliveryPts + pickerPts + inventoryPts;
      const pulse = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));

      // Update breakdown to match calculated points
      const calculatedBreakdown = {
        equipment: Math.round(equipmentPts),
        sla: Math.round(slaPts),
        refunds: Math.round(refundsPts),
        delivery: Math.round(deliveryPts),
        picker: Math.round(pickerPts),
        inventory: Math.round(inventoryPts),
      };

      stores.push({
        id,
        name: `${city === "Delhi NCR" ? "Delhi NCR" : city} ${archetype}`,
        city,
        zone: pick(rand, ZONES),
        manager: override?.manager ?? pick(rand, MANAGERS),
        pulse,
        prevPulse: pulse + intBetween(rand, -3, 9),
        sla: slaPct,
        refundRate: refundRatePct,
        avgResolutionMins,
        openIssues,
        status: statusFor(pulse),
        pickers: intBetween(rand, 8, 22),
        riders: intBetween(rand, 4, 14),
        equipmentFailures14d,
        inventoryIssues,
        deliveryDelays,
        pickerDelayMins,
        breakdown: calculatedBreakdown,
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
  avgResolution: Math.round(STORES.reduce((a, s) => a + s.avgResolutionMins, 0) / STORES.length),
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
    score: Math.round(start + ((store.pulse - start) * i) / (days - 1) + (rand() - 0.5) * 4),
  }));
}
