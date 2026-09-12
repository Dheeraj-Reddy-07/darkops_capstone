import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, ShieldAlert, Phone, PhoneCall, PhoneOff } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  Panel,
  PanelHeader,
  PriorityBadge,
  SlaIndicator,
  StatusBadge,
} from "@/components/ops/primitives";
import { Timeline } from "@/components/ops/timeline";
import {
  useCaseDetail,
  useAssignCase,
  useEscalateCase,
  useResolveCase,
  useAgents,
} from "@/hooks/useCaseDetail";
import { ageLabel, inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/cases/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Case ${params.id} - DarkOps` },
      {
        name: "description",
        content: `Case management record ${params.id}: classification, routing, SLA and resolution timeline.`,
      },
      { property: "og:title", content: `Case ${params.id} - DarkOps` },
      {
        property: "og:description",
        content: "Enterprise case record with classification, routing and resolution timeline.",
      },
    ],
  }),
  component: CaseDetail,
});

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 px-4 py-2.5 last:border-0">
      <p className="label-caps">{label}</p>
      <div className="mt-1 text-[13px] text-foreground">{value}</div>
    </div>
  );
}

function LiveCallPanel({ customerName }: { customerName: string }) {
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "ended">("idle");
  const [timer, setTimer] = useState<number>(0);
  const [timerId, setTimerId] = useState<any>(null);

  const startCall = () => {
    setCallState("dialing");
    setTimeout(() => {
      setCallState("connected");
      setTimer(0);
      const interval = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
      setTimerId(interval);
    }, 1500);
  };

  const endCall = () => {
    if (timerId) clearInterval(timerId);
    setCallState("ended");
  };

  const resetCall = () => {
    setCallState("idle");
    setTimer(0);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Panel>
      <PanelHeader title="Agent Live VoIP Call" subtitle="Escalation stream & interactive voice agent" />
      <div className="p-4 space-y-3">
        {callState === "idle" && (
          <div className="text-center py-3 space-y-2">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary">
              <Phone className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Simulate Customer Call</p>
              <p className="text-[11px] text-muted-foreground">Direct L2 escalation VoIP bridge</p>
            </div>
            <Button onClick={startCall} size="sm" className="w-full gap-2 text-xs">
              <PhoneCall className="size-3.5" /> Call {customerName}
            </Button>
          </div>
        )}

        {callState === "dialing" && (
          <div className="text-center py-3 space-y-2">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-amber-500/10 text-amber-500 animate-pulse">
              <PhoneCall className="size-5 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Connecting to {customerName}...</p>
              <p className="text-[11px] text-muted-foreground">Establishing secure RTP stream</p>
            </div>
            <Button variant="outline" size="sm" onClick={endCall} className="w-full text-xs text-crit">
              Cancel Call
            </Button>
          </div>
        )}

        {callState === "connected" && (
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Live Call</span>
              </div>
              <span className="num text-xs font-bold text-foreground">{formatTimer(timer)}</span>
            </div>

            <div className="p-2.5 bg-muted/40 rounded text-[11px] space-y-1">
              <p className="text-muted-foreground font-medium">Real-time NLP sentiment transcript:</p>
              <p className="text-foreground italic">"Customer confirmed missing items. Escalation resolution approved."</p>
            </div>

            <Button variant="destructive" size="sm" onClick={endCall} className="w-full gap-2 text-xs">
              <PhoneOff className="size-3.5" /> End Call
            </Button>
          </div>
        )}

        {callState === "ended" && (
          <div className="text-center py-3 space-y-2">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground">
              <PhoneOff className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Call Completed ({formatTimer(timer)})</p>
              <p className="text-[11px] text-muted-foreground">Audio recording & transcript saved</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetCall} className="w-full text-xs">
              Reset Call Simulator
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function CaseDetail() {
  const { id } = Route.useParams();
  const { data: record, isLoading, error } = useCaseDetail(id);
  const { data: agents = [] } = useAgents();
  const navigate = useNavigate();
  const assign = useAssignCase();
  const escalate = useEscalateCase();
  const resolve = useResolveCase();

  if (isLoading) return <div className="p-8">Loading case...</div>;
  if (error || !record) return <div className="p-8 text-crit">Failed to load case.</div>;

  const status = record.status;
  // Agent info is now embedded in the record from the API
  const agent =
    record.agentId && record.agentName
      ? { id: record.agentId, name: record.agentName, hub: record.agentHub || "Unassigned" }
      : null;
  // Fraud link comes from the API response
  const fraud = record.fraudReview || null;

  // Transform events for timeline
  const events = record.events.map((e: any) => ({
    time: "IST",
    actor: e.actor_label,
    action: e.action,
  }));

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Operations", to: "/operations" },
          { label: "Live case queue", to: "/operations" },
          { label: record.id },
        ]}
      />

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{record.id}</span>
            <span className="text-base font-normal text-muted-foreground">{record.summary}</span>
          </span>
        }
        subtitle={
          <span className="num">
            {record.complaintId} · {record.storeId} · opened {ageLabel(record.ageMins)} ago · IST
          </span>
        }
        right={
          <>
            <PriorityBadge priority={record.priority} />
            <StatusBadge status={status} />
            <SlaIndicator
              state={record.sla}
              label={
                record.sla === "breached"
                  ? `SLA breached · due ${record.slaDueIST}`
                  : `SLA due ${record.slaDueIST}`
              }
            />
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Panel>
            <PanelHeader
              title="Complaint"
              subtitle={`Raised by ${record.customerName} · ${record.customerId}`}
              right={<Chip tone="info">{record.type}</Chip>}
            />
            <div className="px-4 py-3 text-[13px] leading-relaxed text-foreground">
              {record.detail}
            </div>
            <div className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Customer" value={`${record.customerName} · ${record.customerId}`} />
              <Field
                label="Order"
                value={
                  <span className="num">
                    {record.orderId} · {inr(record.orderValue)}
                  </span>
                }
              />
              <Field
                label="Store"
                value={
                  <Link
                    to="/dark-stores/$id"
                    params={{ id: record.storeId }}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    {record.storeName} <ArrowUpRight className="size-3" />
                  </Link>
                }
              />
              <Field
                label="Delivery partner"
                value={
                  <span>
                    {record.partner}{" "}
                    <span className="num text-muted-foreground">({record.partnerId})</span>
                  </span>
                }
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Classification"
              subtitle={`Automated classification · confidence ${record.classifierConfidence}% · QC score ${record.qcScore}/100`}
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Type" value={record.type} />
              <Field label="Category" value={record.category} />
              <Field label="Urgency" value={record.urgency} />
              <Field label="Sentiment" value={record.sentiment} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Case timeline"
              subtitle="Complaint → QC → classification → unified case → routing → resolution."
            />
            <div className="px-4 py-4">
              <Timeline events={events} />
            </div>
          </Panel>
        </div>

        <aside className="space-y-3">
          <Panel>
            <PanelHeader title="Case summary" />
            <Field
              label="Order value"
              value={<span className="num">{inr(record.orderValue)}</span>}
            />
            <Field
              label="Refund exposure"
              value={<span className="num text-warn">{inr(record.refundAmount)}</span>}
            />
            <Field
              label="SLA deadline"
              value={
                <span className={record.sla === "breached" ? "num text-crit" : "num"}>
                  {record.slaDueIST} IST
                </span>
              }
            />
            <Field
              label="Fraud status"
              value={
                fraud ? (
                  <Link
                    to="/fraud/$id"
                    params={{ id: fraud.id }}
                    className="flex items-center gap-1.5 text-crit hover:underline"
                  >
                    <ShieldAlert className="size-3.5" />
                    Flagged · {fraud.confidence}% confidence
                  </Link>
                ) : (
                  <span className="text-ok">No risk flag</span>
                )
              }
            />
            <Field label="Resolution status" value={record.resolution} />
            <Field
              label="Assigned agent"
              value={
                agent ? (
                  <span>
                    {agent.name} <span className="num text-muted-foreground">({agent.id})</span> ·{" "}
                    {agent.hub}
                  </span>
                ) : (
                  <span className="text-warn">Unassigned</span>
                )
              }
            />
          </Panel>

          <Panel>
            <PanelHeader title="Actions" subtitle="Changes are recorded on the case timeline." />
            <div className="space-y-2 p-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="w-full justify-start">
                    Assign to agent
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  {agents.map((a) => (
                    <DropdownMenuItem
                      key={a.id}
                      onSelect={() => {
                        assign.mutate({ id: record.id, agentId: a.id });
                        toast.success(`${record.id} assigned to ${a.name}`, {
                          description: `${a.hub} hub · ${a.load}/${a.capacity} load`,
                        });
                      }}
                    >
                      {a.name}
                      <span className="num ml-auto text-xs text-muted-foreground">{a.id}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="secondary" className="w-full justify-start">
                    Escalate to L2
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Escalate {record.id} to L2?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The regional manager for {record.city} will be paged and the SLA clock resets
                      to a 60-minute response window.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        escalate.mutate({ id: record.id, level: "L2" });
                        toast.warning(`${record.id} escalated to L2`, {
                          description: `Regional manager · ${record.city}`,
                        });
                      }}
                    >
                      Escalate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full justify-start">Resolve case</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resolve {record.id}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Resolving closes the complaint and releases{" "}
                      <span className="num">{inr(record.refundAmount)}</span> of refund exposure.
                      This cannot be undone from the console.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        resolve.mutate({ id: record.id });
                        toast.success(`${record.id} resolved`, {
                          description: record.resolution,
                        });
                      }}
                    >
                      Resolve
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {fraud ? (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate({ to: "/fraud/$id", params: { id: fraud.id } })}
                >
                  Open risk review
                </Button>
              ) : null}
            </div>
          </Panel>

          <LiveCallPanel customerName={record.customerName} />
        </aside>
      </div>
    </>
  );
}
