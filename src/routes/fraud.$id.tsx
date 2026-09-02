import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldAlert, ChevronDown } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/layout/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chip, KpiCard, Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import { useFraudDetail, useFraudDecision, useFraudHistory } from "@/hooks/useFraudDetail";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fraud/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Risk review ${params.id} — DarkOps` },
      {
        name: "description",
        content: `Risk review for flagged complaint ${params.id}: contributing factors, evidence and claim history.`,
      },
      { property: "og:title", content: `Risk review ${params.id} — DarkOps` },
      {
        property: "og:description",
        content: "Explainable risk scoring with analyst decision controls.",
      },
    ],
  }),
  component: FraudDetail,
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 px-4 py-2.5 last:border-0">
      <p className="label-caps">{label}</p>
      <div className="mt-1 text-[13px]">{value}</div>
    </div>
  );
}

function FraudDetail() {
  const { id } = Route.useParams();
  const { data: record, isLoading, error } = useFraudDetail(id);
  const { data: history = [] } = useFraudHistory(id);
  const decide = useFraudDecision();
  const [note, setNote] = useState("");

  if (isLoading) return <div className="p-8">Loading fraud case...</div>;
  if (error || !record) return <div className="p-8 text-crit">Failed to load fraud case.</div>;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Fraud & risk", to: "/fraud" },
          { label: "AI review queue", to: "/fraud" },
          { label: record.id },
        ]}
      />

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <ShieldAlert className="size-5 text-crit" />
            <span className="num">{record.id}</span>
            <span className="text-base font-normal text-muted-foreground">{record.reason}</span>
          </span>
        }
        subtitle={
          <span className="num">
            {record.customerName} · {record.customerId} · {record.storeName} ({record.storeId})
          </span>
        }
        right={
          <>
            <Chip tone={record.confidence >= 85 ? "crit" : "warn"}>
              Risk confidence {record.confidence}%
            </Chip>
            <StatusBadge status={record.decision} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Risk confidence"
          value={record.confidence}
          unit="%"
          tone={record.confidence >= 85 ? "crit" : "warn"}
          footnote="model score on this claim"
        />
        <KpiCard
          label="Refund requested"
          value={inr(record.refundAmount)}
          tone="warn"
          footnote={`order value ${inr(record.orderValue)}`}
        />
        <KpiCard
          label="Prior claims"
          value={record.priorClaims}
          footnote="last 90 days"
          tone={record.priorClaims > 5 ? "crit" : "neutral"}
        />
        <KpiCard
          label="Upheld against customer"
          value={record.upheldClaims}
          tone={record.upheldClaims > 2 ? "crit" : "ok"}
          footnote="confirmed abuse findings"
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Panel>
            <PanelHeader
              title="Why this was flagged"
              subtitle="Contributing factors with weights and the evidence behind each one."
            />
            <ul>
              {record.factors.map((f: any) => (
                <li key={f.label} className="border-b border-border/70 px-4 py-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium">{f.label}</span>
                    <span
                      className={cn(
                        "num text-[13px]",
                        f.weight >= 25 ? "text-crit" : f.weight >= 14 ? "text-warn" : "text-muted-foreground",
                      )}
                    >
                      +{f.weight} risk
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-sm bg-surface-3">
                    <div
                      className={cn(
                        "h-1.5 rounded-sm",
                        f.weight >= 25 ? "bg-crit" : f.weight >= 14 ? "bg-warn" : "bg-info",
                      )}
                      style={{ width: `${Math.min(100, f.weight * 3)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{f.evidence}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Claim context" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Order" value={<span className="num">{record.orderId}</span>} />
              <Field label="Order value" value={<span className="num">{inr(record.orderValue)}</span>} />
              <Field
                label="Linked case"
                value={
                  <Link
                    to="/cases/$id"
                    params={{ id: record.caseId }}
                    className="num text-primary hover:underline"
                  >
                    {record.caseId}
                  </Link>
                }
              />
              <Field
                label="Store"
                value={
                  <Link
                    to="/dark-stores/$id"
                    params={{ id: record.storeId }}
                    className="text-primary hover:underline"
                  >
                    {record.storeName}
                  </Link>
                }
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Review log" subtitle="Every scoring and decision event on this claim." />
            <ol>
              {history.map((h: any, i: number) => (
                <li
                  key={`${h.at}-${i}`}
                  className="flex items-baseline gap-4 border-b border-border/70 px-4 py-2.5 last:border-0"
                >
                  <span className="num w-24 shrink-0 text-xs text-muted-foreground">{h.at}</span>
                  <span className="text-[13px]">{h.action}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{h.actor}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel>
            <PanelHeader title="Analyst decision" subtitle="A human closes every flagged claim." />
            <div className="space-y-2 p-4">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Decision note (attached to the review log)"
                className="min-h-20 text-xs"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    Update decision <ChevronDown className="size-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[308px]">
                  <DropdownMenuItem
                    onSelect={() => {
                      decide.mutate({ id: record.id, decision: "Approved", note });
                      toast.success(`Refund approved for ${record.id}`);
                    }}
                  >
                    Approve refund
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      decide.mutate({ id: record.id, decision: "Denied", note });
                      toast.error(`Refund denied for ${record.id}`);
                    }}
                  >
                    Deny refund
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      decide.mutate({ id: record.id, decision: "Escalated", note });
                      toast.warning(`Case ${record.id} escalated to management`);
                    }}
                  >
                    Escalate to management
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Customer risk profile" />
            <Field label="Customer" value={`${record.customerName} · ${record.customerId}`} />
            <Field label="Claims in 90 days" value={<span className="num">{record.priorClaims}</span>} />
            <Field
              label="Upheld claims"
              value={<span className="num text-crit">{record.upheldClaims}</span>}
            />
            <Field
              label="Lifetime refund value"
              value={<span className="num">{inr(record.refundAmount * (1 + record.priorClaims))}</span>}
            />
            <Field label="Account standing" value={record.upheldClaims > 2 ? "Restricted" : "Good"} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
