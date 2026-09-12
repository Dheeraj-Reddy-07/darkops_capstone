import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PackageSearch,
  Clock,
  ArrowRight,
  AlertCircle,
  Search,
  RefreshCw,
  X,
} from "lucide-react";
import { Panel, PanelHeader, StatusBadge, Chip } from "@/components/ops/primitives";
import { useCustomerOrders } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/customer/orders/")({
  head: () => ({
    meta: [
      { title: "Order history - DarkOps Care" },
      {
        name: "description",
        content: "View all your orders, track live status, and reorder favorites.",
      },
    ],
  }),
  component: OrderHistory,
});

type FilterTab = "all" | "active" | "delivered";

function OrderHistory() {
  const { data: orders, isLoading, error } = useCustomerOrders();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleReorder = (orderId: string, itemsPreview: string) => {
    toast.success(`Items from #${orderId} added to your reorder cart!`, {
      description: itemsPreview,
    });
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === "active" && order.status === "Delivered") return false;
      if (activeTab === "delivered" && order.status !== "Delivered") return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesItems = order.itemsPreview?.toLowerCase().includes(query);
        const matchesStore = order.storeName?.toLowerCase().includes(query);
        return matchesId || matchesItems || matchesStore;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

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

  const allCount = orders?.length || 0;
  const activeCount = orders?.filter((o) => o.status !== "Delivered").length || 0;
  const deliveredCount = orders?.filter((o) => o.status === "Delivered").length || 0;

  return (
    <div className="w-full space-y-4">
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
            {allCount} total order{allCount !== 1 ? "s" : ""} across dark-store network
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "all"
                ? "bg-surface-2 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All ({allCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "active"
                ? "bg-surface-2 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>In Progress</span>
            {activeCount > 0 && <Chip tone="warn">{activeCount}</Chip>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("delivered")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "delivered"
                ? "bg-surface-2 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Delivered ({deliveredCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order ID, item, or hub..."
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

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Orders"
            subtitle={`${filteredOrders.length} order${filteredOrders.length > 1 ? "s" : ""} matching`}
          />
          <ul className="divide-y divide-border/60">
            {filteredOrders.map((order) => (
              <li
                key={order.id}
                className="border-b border-border/70 p-4 last:border-0 hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Order Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Link
                        to="/customer/orders/$id"
                        params={{ id: order.id }}
                        className="num text-[13px] font-medium hover:underline text-foreground"
                      >
                        {order.id}
                      </Link>
                      <StatusBadge status={order.status} />
                      {order.eta && <Chip tone="info">ETA {order.eta}</Chip>}
                    </div>

                    <p className="text-sm font-medium text-foreground">{order.itemsPreview}</p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.storeName} · {order.items} item{order.items !== 1 ? "s" : ""}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span>Placed: {order.placedAt}</span>
                      </div>
                      {order.deliveredAt && (
                        <div className="flex items-center gap-1">
                          <PackageSearch className="size-3" />
                          <span>Delivered: {order.deliveredAt}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-0 pt-2 sm:pt-0 border-border/50">
                    <p className="num text-[15px] font-semibold text-foreground">
                      {inr(order.total)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => handleReorder(order.id, order.itemsPreview)}
                      >
                        <RefreshCw className="mr-1.5 size-3 text-muted-foreground" />
                        Reorder
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Link to="/customer/orders/$id" params={{ id: order.id }}>
                          Details
                          <ArrowRight className="ml-1 size-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : orders && orders.length > 0 ? (
        <Panel>
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No orders match your filter</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your search query or switching tabs.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel>
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No orders placed yet</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/customer/support">Contact Care</Link>
            </Button>
          </div>
        </Panel>
      )}

      {/* Summary Stats */}
      {orders && orders.length > 0 && (
        <Panel>
          <PanelHeader title="Order Summary" subtitle="Your lifetime quick-commerce stats" />
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <div className="text-center">
              <p className="num text-2xl font-semibold">{allCount}</p>
              <p className="text-xs text-muted-foreground">Total orders placed</p>
            </div>
            <div className="text-center">
              <p className="num text-2xl font-semibold text-warn">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </div>
            <div className="text-center">
              <p className="num text-2xl font-semibold text-ok">{deliveredCount}</p>
              <p className="text-xs text-muted-foreground">Successfully delivered</p>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
