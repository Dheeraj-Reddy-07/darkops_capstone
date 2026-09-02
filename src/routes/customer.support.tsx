import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";
import { Panel, PanelHeader, Chip } from "@/components/ops/primitives";
import { inr } from "@/lib/utils";
import { useCustomerOrders, useSubmitComplaint } from "@/hooks/useCustomer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ISSUE_CATEGORIES = [
  { key: "wrong_item", label: "Wrong item", hint: "You received something you did not order" },
  { key: "missing_item", label: "Missing item", hint: "Part of your order did not arrive" },
  { key: "late_delivery", label: "Late delivery", hint: "The order arrived after the promised time" },
  { key: "damaged_item", label: "Damaged item", hint: "Packaging or contents were damaged" },
  { key: "quality_issue", label: "Quality issue", hint: "Spoiled, expired or thawed product" },
  { key: "payment_issue", label: "Payment issue", hint: "Charge, refund or wallet problem" },
  { key: "other", label: "Other", hint: "Something else about this order" },
];

export const Route = createFileRoute("/customer/support")({
  head: () => ({
    meta: [
      { title: "Report an issue - DarkOps care" },
      {
        name: "description",
        content:
          "Report a problem with a dark store order: pick the order, choose a category, add details and track the complaint.",
      },
      { property: "og:title", content: "Report an issue - DarkOps care" },
      {
        property: "og:description",
        content: "Raise and track a complaint on a recent grocery order.",
      },
    ],
  }),
  component: Support,
});

function Support() {
  const { data: orders, isLoading, error } = useCustomerOrders();
  const submit = useSubmitComplaint();
  const [selectedOrder, setSelectedOrder] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const selected = orders?.find((o) => o.id === selectedOrder);
  const canSubmit = Boolean(selectedOrder && category && details.trim().length > 8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit.mutate(
      { order_id: selectedOrder, category, details },
      {
        onSuccess: (data) => {
          setSubmitted(data.data?.id || data.id);
          toast.success("Complaint submitted", {
            description: "We've received your report and are reviewing it.",
          });
        },
        onError: (err) => {
          toast.error("Failed to submit complaint", {
            description: err.message || "Please try again.",
          });
        },
      }
    );
  };

  if (isLoading) return <div className="p-8">Loading your orders...</div>;

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <h1 className="text-lg font-semibold">Unable to load orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || "Please check your connection and try again."}
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/customer">Back to orders</Link>
          </Button>
        </Panel>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <h1 className="text-lg font-semibold">No orders found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have any recent orders to report an issue against.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/customer">Back to orders</Link>
          </Button>
        </Panel>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-8 text-ok" />
          <h1 className="mt-3 text-lg font-semibold">Complaint raised</h1>
          <p className="num mt-1 text-sm text-muted-foreground">{submitted}</p>
          <p className="mx-auto mt-3 max-w-md text-[13px] text-muted-foreground">
            Your complaint for order <span className="num">{selectedOrder}</span> has been routed to the{" "}
            {selected?.storeName} operations team. Expect a first response within 60 minutes; refunds are
            settled within 24 hours of a decision.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/customer">Track my issue</Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSubmitted(null)}>
              Report another issue
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Report an issue</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Three steps. We route your complaint to the dark store that packed the order.
        </p>
      </div>

      <Panel>
        <PanelHeader title="1 · Which order?" subtitle="Select the order you had a problem with." />
        <ul>
          {orders?.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelectedOrder(o.id)}
                className={cn(
                  "row-hover flex w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left last:border-0",
                  o.id === selectedOrder && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "size-3.5 shrink-0 rounded-full border",
                    o.id === selectedOrder ? "border-primary bg-primary" : "border-border",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="num block text-[13px]">
                    {o.id}
                    <span className="ml-2 font-sans text-xs text-muted-foreground">{o.placedAt}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {o.storeName} · {o.itemsPreview}
                  </span>
                </span>
                <span className="num text-[13px]">{inr(o.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader title="2 · What went wrong?" subtitle="Pick the closest category." />
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {ISSUE_CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "rounded-sm border px-3 py-2.5 text-left transition-colors",
                category === c.key
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-2 hover:border-primary/40",
              )}
            >
              <p className="text-[13px]">{c.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="3 · Tell us more"
          subtitle="Details help us resolve without asking you again."
          right={<Chip tone="neutral">{details.trim().length} chars</Chip>}
        />
        <div className="space-y-3 p-4">
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="For example: the ice cream and frozen peas arrived completely melted at 13:40."
            className="min-h-28 text-[13px]"
          />
          <div className="flex items-center gap-2 rounded-sm border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            <Upload className="size-4" />
            Attach a photo of the item or packaging (optional)
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {selected ? `Routed to ${selected.storeName} · ${selected.storeId}` : "Select an order to proceed"}
            </p>
            <Button type="submit" disabled={!canSubmit || submit.isPending}>
              {submit.isPending ? "Submitting..." : "Submit complaint"}
            </Button>
          </div>
        </div>
      </Panel>
    </form>
  );
}
