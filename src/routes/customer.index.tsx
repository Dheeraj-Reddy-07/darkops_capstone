import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  PackageSearch,
  Clock,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Phone,
  RefreshCw,
  Sparkles,
  MapPin,
  Bike,
  Copy,
  Check,
  ShoppingBag,
  HelpCircle,
} from "lucide-react";
import { Panel, PanelHeader, Chip, StatusBadge } from "@/components/ops/primitives";
import { useCustomerOrders, useCustomerComplaints } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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
  const [copiedPin, setCopiedPin] = useState(false);

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

  const deliveryPin = liveOrder
    ? (liveOrder.id.replace(/\D/g, "").slice(-4) || "4829").padStart(4, "7")
    : "";

  const handleCopyPin = (pin: string) => {
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    toast.success("Delivery PIN copied to clipboard");
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleReorder = (orderId: string, itemsPreview: string) => {
    toast.success(`Items from #${orderId} added to your reorder cart!`, {
      description: itemsPreview,
    });
  };

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

  const issueShortcuts = [
    {
      title: "Missing Item",
      desc: "Item missing from your delivered order",
      category: "missing_item",
      icon: AlertCircle,
    },
    {
      title: "Damaged / Spoiled",
      desc: "Package leaked or items damaged",
      category: "damaged_item",
      icon: ShieldCheck,
    },
    {
      title: "Late Delivery",
      desc: "Order delayed past promised window",
      category: "late_delivery",
      icon: Clock,
    },
    {
      title: "Refund & Billing",
      desc: "Payment deduction or wallet refund",
      category: "payment_issue",
      icon: Sparkles,
    },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Welcome Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {getGreeting()}, {profile?.full_name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {liveOrder
              ? "You have an active order in progress"
              : orders.length > 0
                ? `${orders.length} orders completed`
                : "No orders yet"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/customer/orders">
              <ShoppingBag className="mr-2 size-4" />
              My Orders
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/customer/chat">
              <MessageSquare className="mr-2 size-4" />
              AI Assistant
            </Link>
          </Button>
        </div>
      </div>

      {/* Account Snapshot Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Orders</span>
            <ShoppingBag className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="num text-2xl font-semibold">{orders.length}</span>
            <span className="text-[11px] text-muted-foreground">lifetime</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {orders.length > 0 ? "Quick-commerce deliveries" : "No orders yet"}
          </p>
        </Panel>

        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Delivery Status</span>
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {liveOrder ? (
              <>
                <span className="text-base font-semibold text-warn">In Transit</span>
                <Chip tone="warn">Live</Chip>
              </>
            ) : (
              <>
                <span className="text-base font-semibold text-ok">All Delivered</span>
                <Chip tone="ok">Idle</Chip>
              </>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {liveOrder ? (liveOrder.eta ? `ETA ${liveOrder.eta}` : liveOrder.status) : "Ready for next order"}
          </p>
        </Panel>

        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Support Tickets</span>
            <HelpCircle className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="num text-2xl font-semibold">{activeComplaints.length}</span>
            {activeComplaints.length > 0 ? (
              <Chip tone="warn">{activeComplaints.length} pending</Chip>
            ) : (
              <Chip tone="ok">0 open</Chip>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {activeComplaints.length === 0 ? "Zero active issues" : "In review with care team"}
          </p>
        </Panel>

        <Panel className="p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Assigned Hub</span>
            <MapPin className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="truncate text-base font-semibold">
              {profile?.city || liveOrder?.storeCity || "DarkOps Pod"}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            10-min instant dispatch zone
          </p>
        </Panel>
      </div>

      {/* Active Order with PIN & Partner Info */}
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

          {/* Secure Handover PIN Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface-2/40 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="size-5 text-ok shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Delivery Handover PIN</p>
                <p className="text-[11px] text-muted-foreground">
                  Share this 4-digit PIN with your delivery partner only upon arrival
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded border border-border bg-surface px-3 py-1 font-mono text-base font-bold tracking-widest text-foreground">
                {deliveryPin}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => handleCopyPin(deliveryPin)}
              >
                {copiedPin ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
                <span className="ml-1.5">{copiedPin ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </div>

          {/* Assigned Delivery Partner Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-foreground">
                <Bike className="size-3.5" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {liveOrder.deliveryPartner || "DarkOps Express Partner"}
                </p>
                <p className="text-[11px] text-muted-foreground">Verified Partner · Electric 2W · Insulated Delivery</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => toast.info("Connecting to delivery partner via masked phone call...")}
            >
              <Phone className="mr-1.5 size-3 text-muted-foreground" />
              Call Partner
            </Button>
          </div>

          {/* Stepper */}
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

          <div className="flex flex-wrap items-center justify-between border-t border-border/70 px-4 py-3 gap-2">
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/customer/orders/$id" params={{ id: liveOrder.id }}>
                View order details
                <ArrowRight className="ml-2 size-3" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <Link
                to="/customer/support"
                state={(prev: any) => ({
                  ...prev,
                  usr: { orderId: liveOrder.id },
                })}
              >
                <AlertCircle className="mr-1.5 size-3 text-warn" />
                Report issue on active order
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

      {/* Quick Self-Service Issue Shortcuts */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Issue Resolution
          </h2>
          <span className="text-[11px] text-muted-foreground">Instant self-service support</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {issueShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.category}
                to="/customer/support"
                state={(prev: any) => ({
                  ...prev,
                  usr: {
                    category: item.category,
                    orderId: liveOrder?.id || recentOrders[0]?.id || "",
                  },
                })}
                className="group flex flex-col justify-between rounded-md border border-border bg-surface p-3 transition-colors hover:bg-surface-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex size-7 items-center justify-center rounded bg-surface-2 text-foreground">
                      <Icon className="size-4" />
                    </div>
                    <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <p className="mt-2.5 text-xs font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                    {item.desc}
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-semibold text-primary uppercase tracking-wider">
                  Report issue &rarr;
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Orders with 1-Click Reorder */}
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
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 last:border-0 hover:bg-surface-2/60 transition-colors"
              >
                <Link
                  to="/customer/orders/$id"
                  params={{ id: o.id }}
                  className="flex min-w-0 flex-1 items-center gap-3"
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.preventDefault();
                      handleReorder(o.id, o.itemsPreview);
                    }}
                  >
                    <RefreshCw className="mr-1.5 size-3 text-muted-foreground" />
                    Order again
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No orders yet</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/customer/orders">View orders</Link>
            </Button>
          </div>
        )}
      </Panel>

      {/* DarkOps Customer Quality & Refund Guarantee */}
      <Panel>
        <PanelHeader
          title="DarkOps Customer Guarantee"
          subtitle="100% satisfaction promise on every dark-store drop"
        />
        <div className="grid gap-3 p-4 sm:grid-cols-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="size-3.5 text-ok" />
              <span>10-Minute SLA</span>
            </div>
            <p className="text-muted-foreground">
              Hyperlocal dispatch with cold-chain temperature control for perishables.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="size-3.5 text-ok" />
              <span>Instant Refund Guarantee</span>
            </div>
            <p className="text-muted-foreground">
              Wrong or missing items refunded automatically to your source or DarkOps wallet.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>AI & Human Care</span>
            </div>
            <p className="text-muted-foreground">
              24/7 DarkOps Care bot with seamless 1-click escalation to resolution agents.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
