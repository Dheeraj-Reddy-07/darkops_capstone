import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  PackageSearch,
  Clock,
  AlertCircle,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Panel, PanelHeader, Chip, StatusBadge } from "@/components/ops/primitives";
import { useCustomerOrders, useCustomerComplaints } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const Route = createFileRoute("/customer/")({
  head: () => ({
    meta: [
      { title: "Home - DarkOps Care" },
      {
        name: "description",
        content: "Your quick-commerce support hub - track orders, manage complaints, and get help.",
      },
      { property: "og:title", content: "Home - DarkOps Care" },
      {
        property: "og:description",
        content: "Track orders, manage complaints, and get support.",
      },
    ],
  }),
  component: CustomerHome,
});

function CustomerHome() {
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useCustomerOrders();
  const { data: complaintsData, isLoading: complaintsLoading } = useCustomerComplaints();

  // Fetch customer profile for personalized greeting
  const { data: profile } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("customers")
        .select("full_name, city")
        .eq("profile_id", user.id)
        .maybeSingle();

      const customerData = data as any;
      return customerData;
    },
  });

  const orders = ordersData || [];
  const liveOrder = orders.find((o) => o.status !== "Delivered");
  const activeComplaints =
    complaintsData?.filter((c: any) => c.status !== "resolved" && c.status !== "closed") || [];
  const recentOrders = orders.slice(0, 5);

  if (ordersLoading || complaintsLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading your account...</div>
      </div>
    );
  }

  if (ordersError) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold">Unable to load your data</h1>
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getTrackingSteps = (order: any) => {
    const steps = [
      { label: "Order placed", done: true, time: order.placedAt },
      {
        label: "Packing",
        done:
          order.status === "Packing" ||
          order.status === "Out for delivery" ||
          order.status === "Delivered",
        time:
          order.status === "Packing"
            ? "In progress"
            : order.status === "Delivered" || order.status === "Out for delivery"
              ? "Completed"
              : "Pending",
      },
      {
        label: "Out for delivery",
        done: order.status === "Out for delivery" || order.status === "Delivered",
        time:
          order.status === "Out for delivery"
            ? "In progress"
            : order.status === "Delivered"
              ? "Completed"
              : "Pending",
      },
      {
        label: "Delivered",
        done: order.status === "Delivered",
        time: order.status === "Delivered" ? "Completed" : "Pending",
      },
    ];
    return steps;
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Welcome Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {getGreeting()}, {profile?.full_name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {liveOrder
              ? "You have an active order"
              : orders.length > 0
                ? `${orders.length} orders completed`
                : "No orders yet"}
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/customer/chat">
            <MessageSquare className="mr-2 size-4" />
            AI Assistant
          </Link>
        </Button>
      </div>

      {/* Active Order */}
      {liveOrder && (
        <Panel>
          <PanelHeader
            title="Active order"
            subtitle={`${liveOrder.id} · ${liveOrder.storeName} · ${liveOrder.items} items · ${inr(liveOrder.total)}`}
            right={
              liveOrder.eta ? (
                <Chip tone="info">ETA {liveOrder.eta}</Chip>
              ) : (
                <StatusBadge status={liveOrder.status} />
              )
            }
          />
          <ol className="p-4">
            {getTrackingSteps(liveOrder).map((step, i) => (
              <li key={step.label} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  {step.done ? (
                    <CheckCircle2 className="size-4 text-ok" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                  {i < 3 && (
                    <span
                      className={cn("mt-1 w-px flex-1", step.done ? "bg-ok/50" : "bg-border")}
                    />
                  )}
                </div>
                <div className="-mt-0.5">
                  <p className={cn("text-[13px]", !step.done && "text-muted-foreground")}>
                    {step.label}
                  </p>
                  <p className="num text-xs text-muted-foreground">{step.time}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t border-border/70 px-4 py-3">
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/customer/orders/$id" params={{ id: liveOrder.id }}>
                View order details
                <ArrowRight className="ml-2 size-3" />
              </Link>
            </Button>
          </div>
        </Panel>
      )}

      {/* Active Complaints */}
      {activeComplaints.length > 0 && (
        <Panel>
          <PanelHeader
            title="Open issues"
            subtitle={`${activeComplaints.length} complaint${activeComplaints.length > 1 ? "s" : ""} in progress`}
          />
          <div className="divide-y divide-border/60">
            {activeComplaints.map((complaint: any) => (
              <div key={complaint.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{complaint.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {complaint.complaintRef} · {complaint.orderId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Clock className="inline mr-1 size-3" />
                      {complaint.createdAt}
                    </p>
                  </div>
                  <StatusBadge status={complaint.customerStatusLabel || complaint.status} />
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-3 text-xs">
                  <Link to="/customer/complaints/$id" params={{ id: complaint.id }}>
                    Track issue
                    <ArrowRight className="ml-2 size-3" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" className="h-auto flex-col items-start p-4">
          <Link to="/customer/support" className="flex h-full w-full flex-col items-start gap-2">
            <AlertCircle className="size-5 text-crit" />
            <div className="text-left">
              <p className="text-sm font-medium">Report an issue</p>
              <p className="text-xs text-muted-foreground">Missing, wrong, or damaged items</p>
            </div>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto flex-col items-start p-4">
          <Link to="/customer/orders" className="flex h-full w-full flex-col items-start gap-2">
            <PackageSearch className="size-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium">Order history</p>
              <p className="text-xs text-muted-foreground">View all past orders</p>
            </div>
          </Link>
        </Button>
      </div>

      {/* Recent Orders */}
      <Panel>
        <PanelHeader
          title="Recent orders"
          subtitle={
            orders.length > 0 ? `Last ${Math.min(5, orders.length)} orders` : "No orders found"
          }
          right={
            orders.length > 5 && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/customer/orders">View all</Link>
              </Button>
            )
          }
        />
        {recentOrders.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {recentOrders.map((o) => (
              <li key={o.id}>
                <Link
                  to="/customer/orders/$id"
                  params={{ id: o.id }}
                  className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <PackageSearch className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="num text-[13px]">
                      {o.id}
                      <span className="ml-2 font-sans text-xs text-muted-foreground">
                        {o.placedAt}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {o.itemsPreview}
                    </p>
                  </div>
                  <span className="num text-[13px]">{inr(o.total)}</span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No orders yet</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/customer/support">Report an issue</Link>
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
