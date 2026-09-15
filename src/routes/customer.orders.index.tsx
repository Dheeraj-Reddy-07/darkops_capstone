import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageSearch, ArrowRight, AlertCircle, Search, X } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { useCustomerOrders } from "@/hooks/useCustomer";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/orders/")({
  head: () => ({
    meta: [
      { title: "Select Order - DarkOps Care" },
      {
        name: "description",
        content: "Select an order to report an issue or request support.",
      },
    ],
  }),
  component: OrderIssuePicker,
});

function OrderIssuePicker() {
  const { data: orders, isLoading, error } = useCustomerOrders();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!searchQuery.trim()) return orders;
    const query = searchQuery.toLowerCase().trim();
    return orders.filter((order) => {
      const matchesId = order.id.toLowerCase().includes(query);
      const matchesItems = order.itemsPreview?.toLowerCase().includes(query);
      const matchesStore = order.storeName?.toLowerCase().includes(query);
      return matchesId || matchesItems || matchesStore;
    });
  }, [orders, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading recent orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold text-foreground">Unable to load orders</h1>
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
    <div className="w-full space-y-4">
      {/* Header framing: Recent Orders: Select an order to report an issue. */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Recent Orders: Select an order to report an issue
          </h1>
          <p className="text-xs text-muted-foreground">
            Choose an order from your account to initiate an exception report.
          </p>
        </div>
        {/* Search Input */}
        <div className="relative w-full sm:w-64 mt-2 sm:mt-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Orders List Cards */}
      {filteredOrders.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Orders"
            subtitle={`${filteredOrders.length} recent order${filteredOrders.length > 1 ? "s" : ""}`}
          />
          <ul className="divide-y divide-border/60">
            {filteredOrders.map((order) => (
              <li
                key={order.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      Order #{order.id}
                    </span>
                    <span className="text-xs text-muted-foreground">· {order.placedAt}</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/90 font-medium">
                    {inr(order.total)} · {order.items} items · Dark Store: {order.storeName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    Items preview: {order.itemsPreview}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
                    <Link to="/customer/orders/$id" params={{ id: order.id }}>
                      View details
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="h-8 text-xs">
                    <Link to="/report-issue" search={{ order: order.id }}>
                      <AlertCircle className="mr-1.5 size-3.5 text-warn" />
                      Report an Issue
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel>
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No orders found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {searchQuery
                ? "No recent orders match your search query."
                : "No orders have been placed on this account yet."}
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
