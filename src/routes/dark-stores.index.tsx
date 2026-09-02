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
      { title: "Dark store network — DarkOps" },
      {
        name: "description",
        content:
          "All 200 dark stores with PulseScore, SLA, refund rate and open issues across 14 Indian cities.",
      },
      { property: "og:title", content: "Dark store network — DarkOps" },
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

function StoreNetwork() {
  const navigate = useNavigate();
  const [city, setCity] = useState("all");
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");
  const [band, setBand] = useState("all");
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useStores();

  // Derive unique cities and zones from store data
  const cities = useMemo(() => {
    if (!data?.stores) return [];
    return Array.from(new Set(data.stores.map(s => s.city))).sort();
  }, [data?.stores]);

  const zones = useMemo(() => {
    if (!data?.stores) return [];
    return Array.from(new Set(data.stores.map(s => s.zone))).sort();
  }, [data?.stores]);

  const rows = useMemo(() => {
    if (!data?.stores) return [];
    return data.stores.filter((s) => {
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
        return true;
      }).sort((a, b) => a.pulse - b.pulse);
  }, [data, city, zone, status, band, query]);

  const reset = () => {
    setCity("all");
    setZone("all");
    setStatus("all");
    setBand("all");
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
        <KpiCard label="Network SLA" value={kpis.avgSla} unit="%" tone="warn" footnote="target 95%" />
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
          right={<Chip tone="neutral">{rows.length} of {stores.length}</Chip>}
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

          <button
            onClick={reset}
            className="ml-auto rounded-sm border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
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
                <Th>Store</Th>
                <Th>Store ID</Th>
                <Th>City</Th>
                <Th>Manager</Th>
                <Th align="right">PulseScore</Th>
                <Th align="right">Open issues</Th>
                <Th align="right">SLA</Th>
                <Th align="right">Refund rate</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((s) => (
                <tr
                  key={s.id}
                  className={cn(
                    "row-hover",
                    s.id ? "cursor-pointer" : "cursor-not-allowed opacity-60"
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
                        s.status === "critical" ? "Critical" : s.status === "at-risk" ? "At risk" : "Healthy"
                      }
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
        {rows.length > 60 ? (
          <p className="num border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Showing first 60 of {rows.length} matching stores
          </p>
        ) : null}
      </Panel>
    </>
  );
}
