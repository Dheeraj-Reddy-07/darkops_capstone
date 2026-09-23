import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  EmptyState,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
  StatusBadge,
  TableShell,
  Td,
  Th,
} from "@/components/ops/primitives";
import { useStores } from "@/hooks/useStores";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dark-stores/")({
  head: () => ({
    meta: [
      { title: "Dark store network - DarkOps" },
      {
        name: "description",
        content:
          "All 200 dark stores with PulseScore, SLA, refund rate and open issues across 14 Indian cities.",
      },
      { property: "og:title", content: "Dark store network - DarkOps" },
      {
        property: "og:description",
        content: "PulseScore, SLA and refund performance for every dark store in the network.",
      },
    ],
  }),
  component: StoreNetwork,
});

const PULSE_BANDS = [
  { key: "all", label: "Any PulseScore" },
  { key: "crit", label: "Below 60" },
  { key: "warn", label: "60 – 79" },
  { key: "ok", label: "80 and above" },
];

const SORT_OPTIONS = [
  { key: "pulse_asc", label: "PulseScore: Low → High (Critical First)" },
  { key: "pulse_desc", label: "PulseScore: High → Low (Best First)" },
  { key: "name_asc", label: "Store Name: A → Z" },
  { key: "name_desc", label: "Store Name: Z → A" },
  { key: "city_asc", label: "City: A → Z" },
  { key: "issues_desc", label: "Open Issues: Most → Least" },
  { key: "sla_asc", label: "SLA Compliance: Lowest First" },
  { key: "sla_desc", label: "SLA Compliance: Highest First" },
  { key: "refund_desc", label: "Refund Rate: Highest First" },
  { key: "refund_asc", label: "Refund Rate: Lowest First" },
] as const;

function StoreNetwork() {
  const navigate = useNavigate();
  const [city, setCity] = useState("all");
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("all");
  const [sortBy, setSortBy] = useState("pulse_asc");
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useStores();

  const [visibleRows, setVisibleRows] = useState(60);

  // Derive unique cities and zones from store data
  const cities = useMemo(() => {
    if (!data?.stores) return [];
    return Array.from(new Set(data.stores.map((s) => s.city))).sort();
  }, [data?.stores]);

  const zones = useMemo(() => {
    if (!data?.stores) return [];
    return Array.from(new Set(data.stores.map((s) => s.zone))).sort();
  }, [data?.stores]);

  const rows = useMemo(() => {
    // When filters change, reset the visible rows count
    setVisibleRows(60);

    if (!data?.stores) return [];
    return data.stores
      .filter((s) => {
        if (city !== "all" && s.city !== city) return false;
        if (zone !== "all" && s.zone !== zone) return false;
        if (status !== "all" && s.status !== status) return false;
        if (band === "crit" && s.pulse >= 60) return false;
        if (band === "warn" && (s.pulse < 60 || s.pulse >= 80)) return false;
        if (band === "ok" && s.pulse < 80) return false;
        if (query) {
          const q = query.toLowerCase();
          return (
            s.name.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q) ||
            s.manager.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "pulse_asc") return a.pulse - b.pulse;
        if (sortBy === "pulse_desc") return b.pulse - a.pulse;
        if (sortBy === "name_asc") return a.name.localeCompare(b.name);
        if (sortBy === "name_desc") return b.name.localeCompare(a.name);
        if (sortBy === "city_asc") return a.city.localeCompare(b.city);
        if (sortBy === "issues_desc") return b.openIssues - a.openIssues;
        if (sortBy === "sla_asc") return a.sla - b.sla;
        if (sortBy === "sla_desc") return b.sla - a.sla;
        if (sortBy === "refund_desc") return b.refundRate - a.refundRate;
        if (sortBy === "refund_asc") return a.refundRate - b.refundRate;
        return a.pulse - b.pulse;
      });
  }, [data, city, zone, status, band, query, sortBy]);

  const reset = () => {
    setCity("all");
    setZone("all");
    setStatus("all");
    setBand("all");
    setSortBy("pulse_asc");
    setQuery("");
  };

  if (isLoading) return <div className="p-8">Loading network data...</div>;
  if (error || !data) return <div className="p-8 text-crit">Failed to load dark stores.</div>;

  const { kpis, stores } = data;

  return (
    <>
      <PageHeader
        title="Dark store network"
        subtitle={`${kpis.storeCount} stores · ${kpis.cityCount} cities · network average PulseScore ${kpis.avgPulse}`}
        right={<LiveTag seconds={9} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Stores in network" value={kpis.storeCount} footnote="live and staffed" />
        <KpiCard
          label="Critical stores"
          value={kpis.criticalStores}
          tone="crit"
          footnote="PulseScore below 60"
        />
        <KpiCard
          label="Network SLA"
          value={kpis.avgSla}
          unit="%"
          tone="warn"
          footnote="target 95%"
        />
        <KpiCard
          label="Network refund rate"
          value={kpis.avgRefundRate}
          unit="%"
          footnote="target 4.0%"
        />
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="All dark stores"
          subtitle="Filter by city, zone, status or PulseScore band. Click a store to open its dashboard."
          right={
            <Chip tone="neutral">
              {rows.length} of {stores.length}
            </Chip>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Store name, ID or manager"
              className="w-56 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c: string) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {zones.map((z: string) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="at-risk">At risk</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
            </SelectContent>
          </Select>

          <Select value={band} onValueChange={setBand}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="PulseScore" />
            </SelectTrigger>
            <SelectContent>
              {PULSE_BANDS.map((b) => (
                <SelectItem key={b.key} value={b.key}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[11px] font-medium text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-56 text-xs bg-surface-2 border-border">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={reset}
            className="rounded-sm border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Reset filters
          </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No stores match these filters"
            hint="Widen the PulseScore band or clear the city filter."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => setSortBy(sortBy === "name_asc" ? "name_desc" : "name_asc")}
                >
                  Store {sortBy.startsWith("name") ? (sortBy === "name_asc" ? "↑" : "↓") : ""}
                </Th>
                <Th>Store ID</Th>
                <Th
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => setSortBy("city_asc")}
                >
                  City {sortBy === "city_asc" ? "↑" : ""}
                </Th>
                <Th>Manager</Th>
                <Th
                  align="right"
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => setSortBy(sortBy === "pulse_asc" ? "pulse_desc" : "pulse_asc")}
                >
                  PulseScore {sortBy.startsWith("pulse") ? (sortBy === "pulse_asc" ? "↑" : "↓") : ""}
                </Th>
                <Th
                  align="right"
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => setSortBy(sortBy === "issues_desc" ? "pulse_asc" : "issues_desc")}
                >
                  Open issues {sortBy === "issues_desc" ? "↓" : ""}
                </Th>
                <Th
                  align="right"
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => setSortBy(sortBy === "sla_asc" ? "sla_desc" : "sla_asc")}
                >
                  SLA {sortBy.startsWith("sla") ? (sortBy === "sla_asc" ? "↑" : "↓") : ""}
                </Th>
                <Th
                  align="right"
                  className="cursor-pointer select-none hover:text-foreground"
                  onClick={() => setSortBy(sortBy === "refund_desc" ? "refund_asc" : "refund_desc")}
                >
                  Refund rate {sortBy.startsWith("refund") ? (sortBy === "refund_desc" ? "↓" : "↑") : ""}
                </Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visibleRows).map((s) => (
                <tr
                  key={s.id}
                  className={cn(
                    "row-hover",
                    s.id ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                  )}
                  onClick={() => s.id && navigate({ to: "/dark-stores/$id", params: { id: s.id } })}
                >
                  <Td className="text-[13px]">{s.name}</Td>
                  <Td className="num text-[13px] text-muted-foreground">{s.id}</Td>
                  <Td className="text-[13px]">{s.city}</Td>
                  <Td className="text-[13px]">{s.manager}</Td>
                  <Td align="right">
                    <span
                      className={cn(
                        "num font-semibold",
                        s.pulse < 60 ? "text-crit" : s.pulse < 80 ? "text-warn" : "text-ok",
                      )}
                    >
                      {s.pulse}
                    </span>
                  </Td>
                  <Td align="right" className="num text-[13px]">
                    {s.openIssues}
                  </Td>
                  <Td align="right" className="num text-[13px]">
                    {s.sla}%
                  </Td>
                  <Td align="right" className="num text-[13px]">
                    {s.refundRate}%
                  </Td>
                  <Td>
                    <StatusBadge
                      status={
                        s.status === "critical"
                          ? "Critical"
                          : s.status === "at-risk"
                            ? "At risk"
                            : "Healthy"
                      }
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {rows.length > visibleRows ? (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <p className="num text-xs text-muted-foreground">
              Showing first {visibleRows} of {rows.length} matching stores
            </p>
            <button
              onClick={() => setVisibleRows((prev) => Math.min(rows.length, prev + 60))}
              className="rounded-sm border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Show more
            </button>
          </div>
        ) : null}
      </Panel>
    </>
  );
}
