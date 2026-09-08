import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  Package,
  MapPin,
  Truck,
  Clock,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import { useCustomerOrderById } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/orders_/$id")({
  head: () => ({
    meta: [
      { title: "Order details - DarkOps Care" },
      {
        name: "description",
        content: "View detailed order information, items, and delivery status.",
      },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = useParams({ from: "/customer/orders_/$id" });
  const { data: order, isLoading, error } = useCustomerOrderById(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading order details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold">Order not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This order may not exist or you don't have permission to view it.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/customer">Back to home</Link>
          </Button>
        </Panel>
      </div>
    );
  }

  const getTrackingSteps = () => {
    const steps = [
      { label: "Order placed", done: true, time: order.placedAt, icon: Package },
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
        icon: Package,
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
        icon: Truck,
      },
      {
        label: "Delivered",
        done: order.status === "Delivered",
        time: order.status === "Delivered" ? "Completed" : "Pending",
        icon: CheckCircle2,
      },
    ];
    return steps;
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer/orders">
            <ArrowLeft className="mr-2 size-4" />
            Back to orders
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Order details</h1>
          <p className="text-xs text-muted-foreground">{order.id}</p>
        </div>
      </div>

      {/* Order Summary */}
      <Panel>
        <PanelHeader
          title="Order summary"
          subtitle={`${order.storeName} · ${order.items} items · ${inr(order.total)}`}
          right={<StatusBadge status={order.status} />}
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-[13px]">Placed on</p>
              <p className="num text-xs text-muted-foreground">{order.placedAt}</p>
            </div>
          </div>
          {order.eta && (
            <div className="flex items-start gap-3">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px]">Estimated delivery</p>
                <p className="num text-xs text-muted-foreground">{order.eta}</p>
              </div>
            </div>
          )}
          {order.deliveredAt && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-4 shrink-0 text-ok" />
              <div>
                <p className="text-[13px]">Delivered on</p>
                <p className="num text-xs text-muted-foreground">{order.deliveredAt}</p>
              </div>
            </div>
          )}
          {order.storeCity && (
            <div className="flex items-start gap-3">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px]">Store location</p>
                <p className="num text-xs text-muted-foreground">{order.storeCity}</p>
              </div>
            </div>
          )}
          {order.deliveryPartner && (
            <div className="flex items-start gap-3">
              <Truck className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px]">Delivery partner</p>
                <p className="num text-xs text-muted-foreground">{order.deliveryPartner}</p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Order Items */}
      <Panel>
        <PanelHeader title="Order items" subtitle={`${order.orderItems.length} items`} />
        <ul className="divide-y divide-border/60">
          {order.orderItems.map((item, index) => (
            <li key={index} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13px]">{item.name}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
              </div>
              <span className="num text-[13px]">{inr(item.unitPrice * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border/70 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Total</p>
            <p className="num text-lg font-semibold">{inr(order.total)}</p>
          </div>
        </div>
      </Panel>

      {/* Delivery Timeline */}
      <Panel>
        <PanelHeader title="Delivery timeline" subtitle="Track your order progress" />
        <ol className="p-4">
          {getTrackingSteps().map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.label} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      step.done ? "bg-ok/10" : "bg-surface-2",
                    )}
                  >
                    <Icon
                      className={cn("size-4", step.done ? "text-ok" : "text-muted-foreground")}
                    />
                  </div>
                  {i < 3 && (
                    <span
                      className={cn("mt-2 w-px flex-1", step.done ? "bg-ok/50" : "bg-border")}
                    />
                  )}
                </div>
                <div className="-mt-1">
                  <p className={cn("text-[13px]", !step.done && "text-muted-foreground")}>
                    {step.label}
                  </p>
                  <p className="num text-xs text-muted-foreground">{step.time}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      {/* Report Issue — shown for any order status */}
      <Panel>
        <div className="p-4">
          <p className="text-sm font-medium">Have an issue with this order?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Report missing, wrong, or damaged items and we'll help you resolve it.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/customer/support" state={{ orderId: order.id } as any}>
              Report an issue
            </Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
