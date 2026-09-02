import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  EmptyState,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
  StatusBadge,
  TableShell,
  Td,
  Th,
} from "@/components/ops/primitives";
import { useFraudCases } from "@/hooks/useFraudCases";
import { inr, num, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/fraud/")({
  head: () => ({
    meta: [
      { title: "Fraud & risk review - DarkOps" },
      {
        name: "description",
        content:
          "AI-flagged complaints and refund claims with confidence scores, risk factors and analyst decisions.",
      },
      { property: "og:title", content: "Fraud & risk review - DarkOps" },
      {
        property: "og:description",
        content: "Risk queue for flagged refund claims across the dark store network.",
      },
    ],
  }),
  component: FraudQueue,
});

function FraudQueue() {
  const navigate = useNavigate();
  const [decision, setDecision] = useState("all");
  const [band, setBand] = useState("all");
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useFraudCases();

  const rows = useMemo(() => {
    if (!data?.cases) return [];
    return data.cases.filter((f) => {
        if (decision !== "all" && f.decision !== decision) return false;
        if (band === "high" && f.confidence < 85) return false;
        if (band === "medium" && (f.confidence < 70 || f.confidence >= 85)) return false;
        if (band === "low" && f.confidence >= 70) return false;
        if (query) {
          const q = query.toLowerCase();
          return (
            f.id.toLowerCase().includes(q) ||
            f.customerName.toLowerCase().includes(q) ||
            f.storeId.toLowerCase().includes(q) ||
            f.orderId.toLowerCase().includes(q)
          );
        }
        return true;
      }).sort((a, b) => b.confidence - a.confidence);
  }, [data, decision, band, query]);

  if (isLoading) return <div className="p-8">Loading fraud queue...</div>;
  if (error || !data) return <div className="p-8 text-crit">Failed to load fraud queue.</div>;

  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Risk & Trust queue"
        subtitle="Manual review of high-confidence fraud flags before refund issuance."
        right={<LiveTag seconds={11} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          label="Flagged claims"
          value={num(kpis.flaggedClaims)}
          footnote="awaiting review"
        />
        <KpiCard
          label="Value at risk"
          value={`₹${num(kpis.flaggedValue)}`}
          tone="crit"
          alert
          footnote="in pending queue"
        />
        <KpiCard
          label="Avg confidence"
          value={`${kpis.avgConfidence}%`}
          footnote="classifier score"
        />
        <KpiCard
          label="Repeat offenders"
          value={num(kpis.repeatOffenders)}
          tone="warn"
          footnote=">3 claims in 90d"
        />
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="AI-flagged complaints"
          subtitle="Sorted by risk confidence. Open a row to see factors, evidence and customer history."
          right={<Chip tone="neutral">{rows.length} in queue</Chip>}
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Complaint, customer, store or order"
              className="w-60 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Decision" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any decision</SelectItem>
              <SelectItem value="Pending review">Pending review</SelectItem>
              <SelectItem value="Escalated">Escalated</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Denied">Denied</SelectItem>
            </SelectContent>
          </Select>

          <Select value={band} onValueChange={setBand}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Confidence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any confidence</SelectItem>
              <SelectItem value="high">85% and above</SelectItem>
              <SelectItem value="medium">70 – 84%</SelectItem>
              <SelectItem value="low">Below 70%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No flagged claims match" hint="Clear the confidence band filter." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Complaint</Th>
                <Th>Customer</Th>
                <Th>Store</Th>
                <Th align="right">Refund</Th>
                <Th align="right">Risk</Th>
                <Th>Reason</Th>
                <Th>Decision</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.id}
                  className="row-hover cursor-pointer"
                  onClick={() => navigate({ to: "/fraud/$id", params: { id: f.id } })}
                >
                  <Td className="num text-[13px]">
                    <span className="flex items-center gap-2">
                      <ShieldAlert
                        className={cn(
                          "size-3.5",
                          f.confidence >= 85 ? "text-crit" : "text-warn",
                        )}
                      />
                      {f.id}
                    </span>
                  </Td>
                  <Td className="text-[13px]">
                    {f.customerName}
                    <span className="num ml-2 text-xs text-muted-foreground">{f.customerId}</span>
                  </Td>
                  <Td className="text-[13px]">
                    {f.storeName}
                    <span className="num ml-2 text-xs text-muted-foreground">{f.storeId}</span>
                  </Td>
                  <Td align="right" className="num text-[13px]">
                    {inr(f.refundAmount)}
                  </Td>
                  <Td align="right">
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-sm bg-surface-3">
                        <span
                          className={cn(
                            "block h-1.5",
                            f.confidence >= 85 ? "bg-crit" : f.confidence >= 70 ? "bg-warn" : "bg-info",
                          )}
                          style={{ width: `${f.confidence}%` }}
                        />
                      </span>
                      <span
                        className={cn(
                          "num text-[13px] font-semibold",
                          f.confidence >= 85 ? "text-crit" : "text-warn",
                        )}
                      >
                        {f.confidence}%
                      </span>
                    </span>
                  </Td>
                  <Td className="max-w-[300px] truncate text-xs text-muted-foreground">{f.reason}</Td>
                  <Td>
                    <StatusBadge status={f.decision} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </>
  );
}
