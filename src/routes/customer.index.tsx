import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Circle, PackageSearch } from "lucide-react";
import { Panel, PanelHeader, Chip, StatusBadge } from "@/components/ops/primitives";
import { useCustomerOrders, useCustomerComplaints } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/")({
  head: () => ({
    meta: [
      { title: "Your orders - DarkOps care" },
      {
        name: "description",
        content:
          "Track live orders, follow an open complaint and check refund status for your dark store deliveries.",
      },
      { property: "og:title", content: "Your orders - DarkOps care" },
      {
        property: "og:description", content: "Live order tracking, complaint status and refunds in one place." },
    ],
  }),
  component: CustomerPortal,
});

function CustomerPortal() {
  const navigate = useNavigate();
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useCustomerOrders();
  const { data: complaintsData, isLoading: complaintsLoading } = useCustomerComplaints();

  const orders = ordersData || [];
  const live = orders.find(o => o.status !== 'Delivered') || orders[0];
  const activeComplaint = complaintsData?.find((c: any) => c.status !== 'resolved');

  if (ordersLoading || complaintsLoading) return <div className="p-8">Loading your orders...</div>;
  if (ordersError) return <div className="p-8">Error loading orders. Please try again.</div>;

  const TRACKING_STEPS = [
    { label: "Order placed", at: live?.placedAt || "", done: true },
    { label: "Packing", at: live?.status === 'Packing' ? "In progress" : live?.status === 'Delivered' ? "Completed" : "Pending", done: live?.status === 'Delivered' || live?.status === 'Out for delivery' || live?.status === 'Packing' },
    { label: "Out for delivery", at: live?.status === 'Out for delivery' ? "In progress" : live?.status === 'Delivered' ? "Completed" : "Pending", done: live?.status === 'Delivered' || live?.status === 'Out for delivery' },
    { label: "Delivered", at: live?.status === 'Delivered' ? "Completed" : "Pending", done: live?.status === 'Delivered' },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Your orders</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Track live orders, complaints, and refunds
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/customer/support">Report an issue</Link>
        </Button>
      </div>

      {live && (
        <Panel>
          <PanelHeader
            title={live.status === 'Delivered' ? "Recent order" : "Arriving now"}
            subtitle={`${live.id} · ${live.storeName} · ${live.items} items · ${inr(live.total)}`}
            right={live.eta ? <Chip tone="info">ETA {live.eta}</Chip> : <StatusBadge status={live.status} />}
          />
          <ol className="p-4">
            {TRACKING_STEPS.map((s, i) => (
              <li key={s.label} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  {s.done ? (
                    <CheckCircle2 className="size-4 text-ok" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  {i < TRACKING_STEPS.length - 1 ? (
                    <span className={cn("mt-1 w-px flex-1", s.done ? "bg-ok/50" : "bg-border")} />
                  ) : null}
                </div>
                <div className="-mt-0.5">
                  <p className={cn("text-[13px]", !s.done && "text-muted-foreground")}>{s.label}</p>
                  <p className="num text-xs text-muted-foreground">{s.at}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {activeComplaint && (
        <Panel>
          <PanelHeader
            title="Your open issue"
            subtitle={`${activeComplaint.summary} · raised ${activeComplaint.createdAt}`}
            right={<StatusBadge status={activeComplaint.status} />}
          />
          <div className="p-4">
            <p className="text-xs text-muted-foreground">
              Complaint <span className="num">{activeComplaint.complaintRef}</span> for order{" "}
              <span className="num">{activeComplaint.orderId}</span>. Status: <span className="font-medium">{activeComplaint.status}</span>.
              {activeComplaint.resolution && <span> Resolution: {activeComplaint.resolution}</span>}
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link to="/customer/support">Add more details</Link>
            </Button>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Recent orders" subtitle={orders.length > 0 ? "Last 30 days" : "No orders found"} />
        <ul className="divide-y divide-border/60">
          {orders.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0"
            >
              <PackageSearch className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="num text-[13px]">
                  {o.id}
                  <span className="ml-2 font-sans text-xs text-muted-foreground">{o.placedAt}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.itemsPreview}</p>
              </div>
              <span className="num text-[13px]">{inr(o.total)}</span>
              <StatusBadge status={o.status} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
