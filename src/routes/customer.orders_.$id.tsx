import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, AlertCircle, Clock, MapPin, Truck, CheckCircle2, XCircle } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { useCustomerOrderById } from "@/hooks/useCustomer";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/orders_/$id")({
  head: () => ({
    meta: [
      { title: "Order Details - DarkOps Care" },
      {
        name: "description",
        content: "View complaint-grounding order context and item details.",
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
        <div className="text-sm text-muted-foreground">Loading order context...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold text-foreground">Order Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This order could not be found or is not associated with your account.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/customer/orders">Back to Recent Orders</Link>
          </Button>
        </Panel>
      </div>
    );
  }

  const isDelivered =
    order.status === "Delivered" || order.status === "delivered" || !!order.deliveredAt;

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer/orders">
            <ArrowLeft className="mr-2 size-4" />
            Back to Orders
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Order Context</h1>
          <p className="text-xs text-muted-foreground">Order #{order.id}</p>
        </div>
        <Button asChild size="sm">
          <Link to="/report-issue" search={{ order: order.id }}>
            <AlertCircle className="mr-1.5 size-4 text-warn" />
            Report an Issue
          </Link>
        </Button>
      </div>

      {/* Complaint-Grounding Order Summary */}
      <Panel>
        <PanelHeader
          title="Order Summary"
          subtitle={`${order.storeName} · ${order.items} items · ${inr(order.total)}`}
          right={
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-xs font-semibold">
              {isDelivered ? (
                <>
                  <CheckCircle2 className="size-3.5 text-ok" />
                  <span className="text-ok">Delivered</span>
                </>
              ) : (
                <>
                  <XCircle className="size-3.5 text-warn" />
                  <span className="text-warn">Not delivered</span>
                </>
              )}
            </div>
          }
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 text-xs">
          <div className="flex items-start gap-2.5">
            <Clock className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Order Date</p>
              <p className="text-muted-foreground">{order.placedAt}</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Fulfillment Dark Store</p>
              <p className="text-muted-foreground">Dark Store: {order.storeName}</p>
            </div>
          </div>

          {order.deliveryPartner && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <Truck className="size-4 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Assigned Delivery Partner</p>
                <p className="text-muted-foreground">
                  Delivered by {order.deliveryPartner} (Static Reference)
                </p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Order Line Items */}
      <Panel>
        <PanelHeader title="Purchased Items" subtitle={`${order.orderItems.length} line items`} />
        <ul className="divide-y divide-border/60">
          {order.orderItems.map((item, index) => (
            <li key={index} className="flex items-center justify-between px-4 py-3 text-xs">
              <div>
                <p className="font-semibold text-foreground">{item.name}</p>
                <p className="text-muted-foreground">Quantity: {item.quantity}</p>
              </div>
              <span className="font-mono text-xs font-semibold text-foreground">
                {inr(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border/70 px-4 py-3 bg-surface-2/20">
          <div className="flex items-center justify-between text-sm font-semibold text-foreground">
            <span>Total Order Amount</span>
            <span className="font-mono text-base">{inr(order.total)}</span>
          </div>
        </div>
      </Panel>

      {/* Issue Action Card */}
      <Panel>
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground">
              Need to report a problem with this order?
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Report missing items, damaged products, or delivery delays for quick investigation.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/report-issue" search={{ order: order.id }}>
              <AlertCircle className="mr-1.5 size-3.5" />
              Report an Issue
            </Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
