import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageSearch, Clock, ArrowRight, AlertCircle } from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import { useCustomerOrders } from "@/hooks/useCustomer";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/orders/")({
  head: () => ({
    meta: [
      { title: "Order history - DarkOps Care" },
      {
        name: "description",
        content: "View all your orders and their status.",
      },
    ],
  }),
  component: OrderHistory,
});

function OrderHistory() {
  const { data: orders, isLoading, error } = useCustomerOrders();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading order history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold">Unable to load orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please check your connection and try again.
          </p>
          <Button onClick={() => window.location.reload()} size="sm" className="mt-4">
            Retry
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer">
            <ArrowRight className="mr-2 size-4 rotate-180" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Order history</h1>
          <p className="text-xs text-muted-foreground">
            {orders?.length || 0} total order{orders?.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Orders List */}
      {orders && orders.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Orders"
            subtitle={`${orders.length} order${orders.length > 1 ? "s" : ""} found`}
          />
          <ul className="divide-y divide-border/60">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  to="/customer/orders/$id"
                  params={{ id: order.id }}
                  className="block border-b border-border/70 px-4 py-4 last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="num text-[13px]">{order.id}</p>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-sm">{order.itemsPreview}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.storeName} · {order.items} item{order.items !== 1 ? "s" : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{order.placedAt}</span>
                        </div>
                        {order.eta && (
                          <div className="flex items-center gap-1">
                            <PackageSearch className="size-3" />
                            <span>ETA {order.eta}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="num text-[13px]">{inr(order.total)}</p>
                      <ArrowRight className="mt-2 size-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel>
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No orders yet</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/customer/support">Report an issue</Link>
            </Button>
          </div>
        </Panel>
      )}

      {/* Summary Stats */}
      {orders && orders.length > 0 && (
        <Panel>
          <PanelHeader title="Summary" subtitle="Your order statistics" />
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <div className="text-center">
              <p className="text-2xl font-semibold">{orders.length}</p>
              <p className="text-xs text-muted-foreground">Total orders</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-warn">
                {orders.filter((o) => o.status !== "Delivered").length}
              </p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-ok">
                {orders.filter((o) => o.status === "Delivered").length}
              </p>
              <p className="text-xs text-muted-foreground">Delivered</p>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
