import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Settings,
  Wrench,
} from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
  StatusBadge,
} from "@/components/ops/primitives";
import {
  useStoreDetail,
  useStoreWorkOrders,
  useCreateWorkOrder,
} from "@/hooks/useStoreDetail";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/dark-stores/$id/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} - Dark Store Dashboard - DarkOps` },
      {
        name: "description",
        content: `Operations dashboard for dark store ${params.id}: PulseScore, SLA, equipment status and open work orders.`,
      },
      { property: "og:title", content: `${params.id} - Dark Store - DarkOps` },
      {
        property: "og:description",
        content: "Real-time dark store health, equipment and work order management.",
      },
    ],
  }),
  component: StoreDetail,
});

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 px-4 py-2.5 last:border-0">
      <p className="label-caps">{label}</p>
      <div className="mt-1 text-[13px] text-foreground">{value}</div>
    </div>
  );
}

function NewWorkOrderDialog({ storeId }: { storeId: string }) {
  const [open, setOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [priority, setPriority] = useState("P2");
  const [description, setDescription] = useState("");
  const create = useCreateWorkOrder();

  const handleSubmit = () => {
    if (!assetName.trim() || description.trim().length < 10) {
      toast.error("Please fill in all fields (description must be at least 10 characters)");
      return;
    }
    create.mutate(
      {
        storeId,
        asset_id: `ASSET-${Date.now()}`,
        asset_name: assetName,
        priority,
        description,
      },
      {
        onSuccess: () => {
          toast.success("Work order created", {
            description: `${priority} · ${assetName}`,
          });
          setOpen(false);
          setAssetName("");
          setPriority("P2");
          setDescription("");
        },
        onError: () => {
          toast.error("Failed to create work order");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Wrench className="size-3.5" />
          New work order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create work order</DialogTitle>
          <DialogDescription>
            Raise a maintenance or repair task for {storeId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="label-caps mb-1 block">Asset name</label>
            <input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. Freezer Unit A3"
              className="w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="label-caps mb-1 block">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm outline-none"
            >
              <option value="P1">P1 – Critical</option>
              <option value="P2">P2 – High</option>
              <option value="P3">P3 – Medium</option>
              <option value="P4">P4 – Low</option>
            </select>
          </div>
          <div>
            <label className="label-caps mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue and required work... (min 10 characters)"
              rows={3}
              className="w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {description.length}/10 characters minimum
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending || !assetName.trim() || !description.trim()}
          >
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoreDetail() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useStoreDetail(id);
  const { data: workOrders = [] } = useStoreWorkOrders(id);

  if (isLoading) return <div className="p-8">Loading store dashboard...</div>;
  if (error || !data)
    return <div className="p-8 text-crit">Failed to load store data.</div>;

  const { store, series } = data;

  const pulseColor =
    store.pulse < 60 ? "crit" : store.pulse < 80 ? "warn" : "ok";

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Dark store network", to: "/dark-stores" },
          { label: store.id },
        ]}
      />

      <PageHeader
        title={store.name}
        subtitle={`${store.id} · ${store.city} · ${store.zone} zone · managed by ${store.manager}`}
        right={
          <>
            <LiveTag seconds={9} />
            <Chip tone={pulseColor}>PulseScore {store.pulse}/100</Chip>
            <StatusBadge
              status={
                store.status === "critical"
                  ? "Critical"
                  : store.status === "at-risk"
                    ? "At risk"
                    : "Healthy"
              }
            />
            <NewWorkOrderDialog storeId={id} />
          </>
        }
      />

      {/* Warning banner for critical stores */}
      {store.pulse < 60 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-crit/40 bg-crit-soft/25 px-4 py-3">
          <AlertTriangle className="size-4 text-crit" />
          <p className="text-[13px] font-medium">
            This store is in critical condition — PulseScore below 60. Immediate
            intervention required.
          </p>
          <Link
            to="/dark-stores/$id/pulse"
            params={{ id: store.id }}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-crit hover:underline"
          >
            View deduction ledger <ChevronRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          label="PulseScore"
          value={store.pulse}
          unit="/100"
          tone={pulseColor}
          footnote={`was ${store.prevPulse} last week`}
          emphasis
        />
        <KpiCard
          label="SLA compliance"
          value={store.sla}
          unit="%"
          tone={store.sla < 85 ? "crit" : store.sla < 95 ? "warn" : "ok"}
          footnote="target 95%"
        />
        <KpiCard
          label="Refund rate"
          value={store.refundRate}
          unit="% GMV"
          tone={
            store.refundRate > 6 ? "crit" : store.refundRate > 4 ? "warn" : "ok"
          }
          footnote="target 4.0%"
        />
        <KpiCard
          label="Open issues"
          value={store.openIssues}
          tone={
            store.openIssues > 5 ? "crit" : store.openIssues > 2 ? "warn" : "ok"
          }
          footnote="active complaints"
        />
        <KpiCard
          label="Pickers on shift"
          value={store.pickers}
          footnote="currently active"
        />
        <KpiCard
          label="Riders assigned"
          value={store.riders}
          footnote="on this store"
        />
      </div>

      {/* Charts row */}
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Equipment failures & stockouts – last 14 days"
            subtitle="Cold-chain failures and inventory mismatches drive PulseScore deductions."
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series} margin={{ left: -18, right: 8, top: 4 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={1} />
                <YAxis {...axis} width={48} />
                <RTooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  cursor={{ fill: "var(--surface-2)" }}
                />
                <Bar
                  dataKey="failures"
                  name="Equipment failures"
                  fill="var(--chart-4)"
                  maxBarSize={28}
                />
                <Bar
                  dataKey="stockouts"
                  name="Stockouts"
                  fill="var(--chart-3)"
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Delivery downtime – last 14 days"
            subtitle="Rider dwell and equipment downtime hours per day."
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={series} margin={{ left: -18, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="downtimeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={1} />
                <YAxis {...axis} width={48} />
                <RTooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                />
                <Area
                  type="monotone"
                  dataKey="downtime"
                  name="Downtime (hrs)"
                  stroke="var(--chart-1)"
                  fill="url(#downtimeFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Details + Work orders */}
      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_400px]">
        <Panel>
          <PanelHeader
            title="Current metrics"
            subtitle="Live operational figures for this store."
            right={
              <Link
                to="/dark-stores/$id/pulse"
                params={{ id: store.id }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                PulseScore breakdown <ArrowUpRight className="size-3" />
              </Link>
            }
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Store ID" value={<span className="num">{store.id}</span>} />
            <Field label="City" value={store.city} />
            <Field label="Zone" value={store.zone} />
            <Field label="Manager" value={store.manager} />
            <Field
              label="Avg resolution"
              value={
                <span className="num">
                  {store.avgResolutionMins}
                  <span className="text-xs text-muted-foreground"> min</span>
                </span>
              }
            />
            <Field
              label="Equipment failures (14d)"
              value={
                <span
                  className={cn(
                    "num",
                    store.equipmentFailures14d > 3 ? "text-crit" : "text-foreground",
                  )}
                >
                  {store.equipmentFailures14d}
                </span>
              }
            />
            <Field
              label="Inventory issues"
              value={
                <span
                  className={cn(
                    "num",
                    store.inventoryIssues > 5 ? "text-warn" : "text-foreground",
                  )}
                >
                  {store.inventoryIssues}
                </span>
              }
            />
            <Field
              label="Delivery delays"
              value={<span className="num">{store.deliveryDelays}</span>}
            />
            <Field
              label="Picker delay"
              value={
                <span className="num">
                  {store.pickerDelayMins}
                  <span className="text-xs text-muted-foreground"> min avg</span>
                </span>
              }
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Work orders"
            subtitle="Active maintenance and repair tasks."
            right={<NewWorkOrderDialog storeId={id} />}
          />
          {!workOrders || workOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <Settings className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No open work orders</p>
              <p className="text-xs text-muted-foreground">
                This store has no active maintenance tasks.
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <ul>
                {workOrders.map((wo: any) => (
                  <li key={wo.id} className="flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-0">
                    <span
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                        (wo.priority || wo.urgency) === "P1"
                          ? "bg-crit"
                          : (wo.priority || wo.urgency) === "P2"
                            ? "bg-warn"
                            : "bg-ok"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <p className="truncate text-[13px] font-medium">{wo.asset_name || wo.assetName || "—"}</p>
                        <span className="num text-[11px] text-muted-foreground">{wo.id}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {wo.description || "Maintenance task"}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {wo.created_at ? new Date(wo.created_at).toLocaleDateString() : "Recently"}
                      </p>
                    </div>
                    <Chip
                      tone={
                        (wo.priority || wo.urgency) === "P1"
                          ? "crit"
                          : (wo.priority || wo.urgency) === "P2"
                            ? "warn"
                            : "neutral"
                      }
                      className="shrink-0"
                    >
                      {wo.priority || wo.urgency || "P3"}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
