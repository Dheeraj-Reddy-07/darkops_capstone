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

      // Determine realistic store health tier distribution:
      // ~70% healthy (80-98), ~20% at-risk (60-79), ~10% critical (35-58)
      const roll = rand();
      const isCriticalOverride = override && override.sla < 70;
      const tier = isCriticalOverride
        ? "critical"
        : roll > 0.3
          ? "healthy"
          : roll > 0.1
            ? "at-risk"
            : "critical";

      let equipmentFailures14d: number;
      let slaPct: number;
      let refundRatePct: number;
      let deliveryDelays: number;
      let pickerDelayMins: number;
      let inventoryIssues: number;
      let avgResolutionMins: number;
      let openIssues: number;

      if (tier === "healthy") {
        equipmentFailures14d = Math.floor(rand() * 2);
        slaPct = override?.sla ?? round(93 + rand() * 5.5, 1);
        refundRatePct = override?.refundRate ?? round(1.2 + rand() * 2.3, 1);
        deliveryDelays = Math.floor(rand() * 6);
        pickerDelayMins = round(1.0 + rand() * 1.2, 1);
        inventoryIssues = Math.floor(rand() * 4);
        avgResolutionMins = Math.round(20 + rand() * 25);
        openIssues = Math.floor(rand() * 3);
      } else if (tier === "at-risk") {
        equipmentFailures14d = Math.floor(2 + rand() * 3);
        slaPct = override?.sla ?? round(82 + rand() * 9, 1);
        refundRatePct = override?.refundRate ?? round(4.0 + rand() * 2.2, 1);
        deliveryDelays = Math.floor(6 + rand() * 10);
        pickerDelayMins = round(2.5 + rand() * 1.2, 1);
        inventoryIssues = Math.floor(4 + rand() * 5);
        avgResolutionMins = Math.round(45 + rand() * 30);
        openIssues = Math.floor(3 + rand() * 4);
      } else {
        // critical
        equipmentFailures14d = Math.floor(5 + rand() * 6);
        slaPct = override?.sla ?? round(62 + rand() * 16, 1);
        refundRatePct = override?.refundRate ?? round(6.5 + rand() * 4.5, 1);
        deliveryDelays = Math.floor(16 + rand() * 18);
        pickerDelayMins = round(3.8 + rand() * 2.0, 1);
        inventoryIssues = Math.floor(8 + rand() * 8);
        avgResolutionMins = Math.round(75 + rand() * 45);
        openIssues = Math.floor(7 + rand() * 9);
      }

      // Calculate PulseScore deductions accurately
      const equipmentPts = Math.min(25, equipmentFailures14d * 2.5);
      const slaPts = Math.max(0, (95 - slaPct) * 0.4);
      const refundsPts = Math.max(0, (refundRatePct - 2) * 1.5);
      const deliveryPts = Math.min(15, deliveryDelays * 0.4);
      const pickerPts = Math.max(0, (pickerDelayMins - 2.0) * 1.5);
      const inventoryPts = Math.min(10, inventoryIssues * 0.8);
      const totalDeduction =
        equipmentPts + slaPts + refundsPts + deliveryPts + pickerPts + inventoryPts;
      const pulse = Math.max(15, Math.min(99, Math.round(100 - totalDeduction)));

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
        prevPulse: Math.min(100, Math.max(15, pulse + intBetween(rand, -3, 6))),
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
    const day = 1 + i;
    const dateLabel = `${day} Sep`;
    const failureBase = Math.max(0, store.equipmentFailures14d / 14);
    const stockoutBase = Math.max(0, store.inventoryIssues / 14);
    const downtimeBase = Math.max(0, store.deliveryDelays / 20);

    const v1 = rand();
    const v2 = rand();
    const v3 = rand();

    const failures = Math.max(
      0,
      Math.round(
        failureBase * (0.4 + v1 * 1.6) +
          (store.status === "critical"
            ? i % 3 === 0
              ? 2
              : 1
            : store.status === "at-risk"
              ? i % 5 === 0
                ? 1
                : 0
              : 0),
      ),
    );
    const stockouts = Math.max(
      0,
      Math.round(
        stockoutBase * (0.4 + v2 * 1.6) +
          (store.status === "critical"
            ? i % 2 === 0
              ? 3
              : 1
            : store.status === "at-risk"
              ? i % 4 === 0
                ? 2
                : 0
              : i % 6 === 0
                ? 1
                : 0),
      ),
    );
    const downtime = round(
      Math.max(
        0.1,
        downtimeBase * (0.5 + v3 * 1.5) +
          (store.status === "critical" ? 2.5 : store.status === "at-risk" ? 1.0 : 0.3),
      ),
      1,
    );
    const mismatches = Math.max(0, Math.round(stockouts * 0.4 + (v1 > 0.6 ? 1 : 0)));

    return {
      day: dateLabel,
      failures,
      downtime,
      stockouts,
      mismatches,
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
