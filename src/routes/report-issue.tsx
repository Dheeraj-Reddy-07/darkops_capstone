import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  PackageSearch,
  ShieldAlert,
  X,
} from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import {
  useCustomerOrders,
  useCustomerOrderById,
  useSubmitComplaint,
  useUploadAttachmentUrl,
} from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { queryClient } from "@/lib/queryClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Public demo credential for the pre-seeded customer account. The handoff only
// ever authenticates this single seeded demo customer; the same password is
// already surfaced on the login screen's evaluator quick-access panel.
const DEMO_CUSTOMER_PASSWORD = "password123";

interface ReportIssueSearch {
  order?: string;
  order_id?: string;
  category?: string;
  issue_category?: string;
  store_id?: string;
  delivery_partner_id?: string;
  handoff?: string;
}

export const Route = createFileRoute("/report-issue")({
  validateSearch: (search: Record<string, unknown>): ReportIssueSearch => {
    return {
      order: typeof search.order === "string" ? search.order : undefined,
      order_id: typeof search.order_id === "string" ? search.order_id : undefined,
      category: typeof search.category === "string" ? search.category : undefined,
      issue_category: typeof search.issue_category === "string" ? search.issue_category : undefined,
      store_id: typeof search.store_id === "string" ? search.store_id : undefined,
      delivery_partner_id:
        typeof search.delivery_partner_id === "string" ? search.delivery_partner_id : undefined,
      handoff: typeof search.handoff === "string" ? search.handoff : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Report an Issue - DarkOps Care" },
      { name: "description", content: "Report an issue on your order for fast resolution." },
    ],
  }),
  component: ReportIssuePage,
});

const ISSUE_CATEGORIES = [
  {
    key: "missing_item",
    label: "Missing item",
    hint: "Part or all of your order did not arrive",
    icon: "🔍",
  },
  {
    key: "wrong_item",
    label: "Wrong item received",
    hint: "You received something you did not order",
    icon: "📦",
  },
  {
    key: "damaged_item",
    label: "Damaged item",
    hint: "Packaging or contents were damaged",
    icon: "💔",
  },
  {
    key: "quality_issue",
    label: "Quality issue",
    hint: "Spoiled, expired or poor quality item",
    icon: "🥛",
  },
  {
    key: "late_delivery",
    label: "Late delivery",
    hint: "The order arrived after the promised time",
    icon: "⏰",
  },
  {
    key: "payment_issue",
    label: "Payment or refund issue",
    hint: "Charge, refund or wallet problem",
    icon: "💳",
  },
  { key: "other", label: "Other", hint: "Something else about this order", icon: "❓" },
];

const RESOLUTION_OPTIONS: Record<string, { key: string; label: string; description: string; icon: string }[]> = {
  missing_item: [
    { key: "REFUND", label: "Refund", description: "Request instant refund to original payment method", icon: "💳" },
    { key: "REPLACEMENT", label: "Replacement", description: "Request replacement item fulfillment", icon: "🔄" },
    { key: "SUPPORT_REVIEW", label: "Support Review", description: "Have a support agent review the issue details", icon: "🎧" },
  ],
  wrong_item: [
    { key: "REFUND", label: "Refund", description: "Request refund for incorrect item", icon: "💳" },
    { key: "REPLACEMENT", label: "Replacement", description: "Request correct item replacement", icon: "🔄" },
    { key: "SUPPORT_REVIEW", label: "Support Review", description: "Have a support agent review the issue details", icon: "🎧" },
  ],
  damaged_item: [
    { key: "REFUND", label: "Refund", description: "Request refund for damaged goods", icon: "💳" },
    { key: "REPLACEMENT", label: "Replacement", description: "Request replacement delivery", icon: "🔄" },
    { key: "SUPPORT_REVIEW", label: "Support Review", description: "Have a support agent review photo evidence", icon: "🎧" },
  ],
  quality_issue: [
    { key: "REFUND", label: "Refund", description: "Request refund for poor quality/spoiled item", icon: "💳" },
    { key: "REPLACEMENT", label: "Replacement", description: "Request fresh item replacement", icon: "🔄" },
    { key: "SUPPORT_REVIEW", label: "Support Review", description: "Have quality management team inspect", icon: "🎧" },
  ],
  late_delivery: [
    { key: "REFUND", label: "Refund / Credit", description: "Request delivery fee or compensation credit", icon: "💳" },
    { key: "SUPPORT_REVIEW", label: "Support Review", description: "Review delivery SLA and partner performance", icon: "🎧" },
  ],
  payment_issue: [
    { key: "REFUND", label: "Refund", description: "Request double-charge or wallet balance refund", icon: "💳" },
    { key: "SUPPORT_REVIEW", label: "Support Review", description: "Connect with billing support team", icon: "🎧" },
  ],
  other: [
    { key: "SUPPORT_REVIEW", label: "Support Review", description: "Route complaint to Customer Support agent queue", icon: "🎧" },
  ],
};

function normalizeCategory(catString?: string): string {
  if (!catString) return "";
  const lower = catString.toLowerCase().trim();
  if (lower.includes("missing")) return "missing_item";
  if (lower.includes("wrong")) return "wrong_item";
  if (lower.includes("damage") || lower.includes("spoil")) return "damaged_item";
  if (lower.includes("quality") || lower.includes("expire")) return "quality_issue";
  if (lower.includes("late") || lower.includes("delay")) return "late_delivery";
  if (lower.includes("payment") || lower.includes("refund") || lower.includes("billing"))
    return "payment_issue";
  if (ISSUE_CATEGORIES.some((c) => c.key === lower)) return lower;
  return "other";
}

function ReportIssuePage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  // Handoff token handling
  const handoffToken = searchParams.handoff || "";
  const [isVerifyingHandoff, setIsVerifyingHandoff] = useState(!!handoffToken);
  const verifiedTokenRef = useRef<string | null>(null);

  // Redirect / context parameters
  const targetOrderId = searchParams.order || searchParams.order_id || "";
  const rawCategory = searchParams.category || searchParams.issue_category || "";
  const prefilledCategory = normalizeCategory(rawCategory);
  const deliveryPartnerRef = searchParams.delivery_partner_id || "";

  // Query all customer's orders for picker
  const { data: customerOrders, isLoading: ordersLoading } = useCustomerOrders({
    enabled: !isVerifyingHandoff,
  });

  // Query specific target order ID to verify session ownership (IDOR check)
  const {
    data: singleOrderData,
    isLoading: singleOrderLoading,
    error: singleOrderError,
  } = useCustomerOrderById(targetOrderId, {
    enabled: !isVerifyingHandoff,
  });

  const submit = useSubmitComplaint();
  const uploadUrl = useUploadAttachmentUrl();

  // State management
  const [selectedOrderId, setSelectedOrderId] = useState(targetOrderId);
  const [category, setCategory] = useState(prefilledCategory);
  const [requestedResolution, setRequestedResolution] = useState<string>("REFUND");
  const [details, setDetails] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!handoffToken) {
      setIsVerifyingHandoff(false);
      return;
    }

    if (verifiedTokenRef.current === handoffToken) {
      setIsVerifyingHandoff(false);
      return;
    }
    verifiedTokenRef.current = handoffToken;

    async function verifyToken() {
      try {
        const res = await fetch("/api/v1/auth/handoff/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handoff_token: handoffToken }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const profileEmail = data.userProfile?.email || "customer@darkops.com";

          // Establish a genuine authenticated session for the demo customer. A
          // real Supabase environment ignores stale/synthetic mock sessions (the
          // anti-identity-bleed safeguard), so writing a mock session here would
          // leave the root auth guard seeing "no session" and bounce the user to
          // /login. Signing in through the same path the login screen uses yields
          // a real session (real user id, RLS, profile) in real mode, and fires
          // the mock client's auth listener in local demo mode -- so the root
          // guard recognises the user either way and lands on the customer page.
          const supabase = createSupabaseBrowserClient();
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: profileEmail,
            password: DEMO_CUSTOMER_PASSWORD,
          });
          if (signInError) throw signInError;

          queryClient.clear();

          toast.success("Authenticated via 10MinMart Signed Handoff", {
            description: `Logged in as ${data.userProfile?.full_name || "Customer"}. Order #${data.order_id} pre-filled.`,
          });

          if (data.order_id) {
            setSelectedOrderId(data.order_id);
          }
          if (data.issue_category) {
            const normCat = normalizeCategory(data.issue_category);
            setCategory(normCat);
            const opts = RESOLUTION_OPTIONS[normCat] || RESOLUTION_OPTIONS["other"];
            setRequestedResolution(opts[0]?.key || "SUPPORT_REVIEW");
          }

          navigate({
            to: "/report-issue",
            search: {
              order_id: data.order_id,
              issue_category: data.issue_category,
            },
            replace: true,
          });
        } else {
          const existingSession = localStorage.getItem("darkops_mock_session");
          if (existingSession) {
            navigate({
              to: "/report-issue",
              search: {
                order_id: targetOrderId || searchParams.order_id || searchParams.order,
                issue_category: rawCategory || searchParams.issue_category || searchParams.category,
              },
              replace: true,
            });
          } else {
            localStorage.removeItem("darkops_mock_session");
            toast.error("Authentication Error", { description: "Please sign in to continue" });
            navigate({
              to: "/login",
              search: { message: "Please sign in to continue" },
              replace: true,
            });
          }
        }
      } catch (err: any) {
        const existingSession = localStorage.getItem("darkops_mock_session");
        if (existingSession) {
          navigate({
            to: "/report-issue",
            search: {
              order_id: targetOrderId || searchParams.order_id || searchParams.order,
              issue_category: rawCategory || searchParams.issue_category || searchParams.category,
            },
            replace: true,
          });
        } else {
          localStorage.removeItem("darkops_mock_session");
          toast.error("Authentication Error", { description: "Please sign in to continue" });
          navigate({
            to: "/login",
            search: { message: "Please sign in to continue" },
            replace: true,
          });
        }
      } finally {
        setIsVerifyingHandoff(false);
      }
    }

    verifyToken();
  }, [handoffToken, navigate, rawCategory, searchParams.category, searchParams.issue_category, searchParams.order, searchParams.order_id, targetOrderId]);

  useEffect(() => {
    if (targetOrderId) {
      setSelectedOrderId(targetOrderId);
    }
  }, [targetOrderId]);

  useEffect(() => {
    if (prefilledCategory) {
      setCategory(prefilledCategory);
      const options = RESOLUTION_OPTIONS[prefilledCategory] || RESOLUTION_OPTIONS["other"];
      setRequestedResolution(options[0]?.key || "SUPPORT_REVIEW");
    }
  }, [prefilledCategory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Determine active order object
  // If targetOrderId is specified, check if singleOrderData is valid and owned
  // Otherwise fall back to order selected from list
  const activeOrder = targetOrderId
    ? singleOrderData
    : customerOrders?.find((o) => o.id === selectedOrderId);

  // Security Check (IDOR Protection):
  // If a target order ID was provided in URL query string, but backend returned 403 / 404 / error,
  // we MUST reject access with generic "Order Not Found" state to avoid leaking order existence.
  const isIdorViolationOrNotFound = !!targetOrderId && (!!singleOrderError || !singleOrderData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !category || details.length < 10) return;

    setSubmitError(null);
    setIsUploading(true);

    try {
      const attachmentMeta = [];

      for (const file of attachments) {
        const { data: uploadData } = await uploadUrl.mutateAsync({
          filename: file.name,
          content_type: file.type,
        });

        const uploadResponse = await fetch(uploadData.signedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        attachmentMeta.push({
          filename: file.name,
          storage_path: uploadData.storagePath,
          file_type: file.type,
          file_size_bytes: file.size,
        });
      }

      submit.mutate(
        {
          order_id: activeOrder.id,
          category,
          details,
          requested_resolution: requestedResolution,
          attachments: attachmentMeta,
        },
        {
          onSuccess: (data) => {
            const complaint = data?.data;
            toast.success("Your issue report has been submitted!", {
              description: `Complaint reference: ${complaint?.complaint_ref || complaint?.id}`,
            });
            if (complaint?.id) {
              navigate({ to: "/customer/complaints/$id", params: { id: complaint.id } });
            } else {
              navigate({ to: "/customer/complaints" });
            }
          },
          onError: (err: any) => {
            const message = err?.message || "Failed to submit issue. Please try again.";
            setSubmitError(message);
            toast.error("Submission failed", { description: message });
            setIsUploading(false);
          },
        },
      );
    } catch (err: any) {
      const message = err?.message || "Failed to upload attachments. Please try again.";
      setSubmitError(message);
      toast.error("Upload failed", { description: message });
      setIsUploading(false);
    }
  };

  if (isVerifyingHandoff || ordersLoading || (targetOrderId && singleOrderLoading)) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">
          {isVerifyingHandoff
            ? "Verifying 10MinMart signed handoff token..."
            : "Verifying order context..."}
        </div>
      </div>
    );
  }

  // IDOR / Security Rejection State:
  // Rendered when an order parameter in query string fails session ownership check
  if (isIdorViolationOrNotFound) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/customer/complaints">
              <ArrowLeft className="mr-2 size-4" />
              Back to My Issues
            </Link>
          </Button>
        </div>
        <Panel className="p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-crit" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
            Order Not Found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The requested order identifier ({targetOrderId}) could not be found or is not associated
            with your account.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Please select an order from your recent orders list to submit an issue.
          </p>
          <Button
            onClick={() => {
              // Clear URL target order ID by navigating to base /report-issue
              navigate({ to: "/report-issue", search: {} });
              setSelectedOrderId("");
            }}
            size="sm"
            className="mt-5"
          >
            Select from recent orders
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer/complaints">
            <ArrowLeft className="mr-2 size-4" />
            My Issues
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Report an issue</h1>
          <p className="text-xs text-muted-foreground">
            Initiate an exception request for quick-commerce investigation & resolution.
          </p>
        </div>
      </div>

      {/* 1. Order Picker / Order Context Banner */}
      {!activeOrder ? (
        <Panel>
          <PanelHeader title="Recent Orders" subtitle="Select an order to report an issue" />
          <div className="p-4 space-y-2">
            {customerOrders && customerOrders.length > 0 ? (
              customerOrders.map((o) => (
                <div
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOrderId(o.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedOrderId(o.id);
                  }}
                  className={cn(
                    "w-full flex flex-wrap items-center justify-between rounded-md border border-border px-4 py-3 text-left transition-colors cursor-pointer",
                    selectedOrderId === o.id
                      ? "border-primary bg-primary/5 font-medium"
                      : "hover:bg-surface-2",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="num text-[13px] font-semibold text-foreground">
                      Order #{o.id} ·{" "}
                      <span className="font-normal text-muted-foreground">{o.placedAt}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {inr(o.total)} · {o.items} items · Dark Store: {o.storeName}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs shrink-0 mt-2 sm:mt-0">
                    Select Order
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No recent orders found on your account.
              </div>
            )}
          </div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader
            title="Order Context"
            subtitle={`Order #${activeOrder.id} · ${activeOrder.placedAt}`}
            right={<StatusBadge status={activeOrder.status} />}
          />
          <div className="p-4 border-b border-border/70 text-xs space-y-1">
            <p className="font-semibold text-foreground">{activeOrder.itemsPreview}</p>
            <p className="text-muted-foreground">
              {inr(activeOrder.total)} · {activeOrder.items} items · Dark Store:{" "}
              {activeOrder.storeName}
            </p>
            {deliveryPartnerRef && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Assigned Logistics Ref:{" "}
                <span className="font-mono text-foreground">{deliveryPartnerRef}</span> (Static
                Reference)
              </p>
            )}
          </div>
          {!targetOrderId && (
            <div className="px-4 py-2 bg-surface-2/40 text-right">
              <button
                type="button"
                onClick={() => setSelectedOrderId("")}
                className="text-xs text-primary hover:underline font-medium"
              >
                Change order selection
              </button>
            </div>
          )}
        </Panel>
      )}

      {/* 2. Issue Category Selection */}
      {activeOrder && (
        <Panel>
          <PanelHeader
            title="Issue Classification"
            subtitle="Select the category that best describes your issue"
          />
          <div className="p-4">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ISSUE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setCategory(cat.key);
                    const opts = RESOLUTION_OPTIONS[cat.key] || RESOLUTION_OPTIONS["other"];
                    setRequestedResolution(opts[0]?.key || "SUPPORT_REVIEW");
                  }}
                  className={cn(
                    "flex flex-col items-start rounded-md border border-border p-3 text-left transition-colors",
                    category === cat.key ? "border-primary bg-primary/5" : "hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{cat.icon}</span>
                    <p className="text-xs font-semibold text-foreground">{cat.label}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{cat.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* 2. Desired Resolution Outcome */}
      {activeOrder && category && (
        <Panel>
          <PanelHeader
            title="Desired Outcome"
            subtitle="How would you like this issue resolved? (Subject to eligibility evaluation)"
          />
          <div className="p-4">
            <div className="grid gap-2.5 sm:grid-cols-3">
              {(RESOLUTION_OPTIONS[category] || RESOLUTION_OPTIONS["other"]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRequestedResolution(opt.key)}
                  className={cn(
                    "flex flex-col items-start rounded-md border border-border p-3 text-left transition-colors",
                    requestedResolution === opt.key ? "border-primary bg-primary/5 font-medium" : "hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{opt.icon}</span>
                    <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* 3. Issue Capture & Evidence Form */}
      {activeOrder && category && (
        <Panel>
          <PanelHeader
            title="Issue Details & Evidence"
            subtitle="Provide description and evidence for investigation"
          />
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Describe what happened *
              </label>
              <textarea
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  setSubmitError(null);
                }}
                placeholder="Explain what was missing, wrong, damaged, or delayed..."
                className="w-full min-h-[110px] rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                required
                minLength={10}
              />
              <p className="text-[11px] text-muted-foreground">
                {details.length} / 10 characters minimum
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Photo evidence (optional)
              </label>
              <div className="border border-dashed border-border rounded-md p-3 text-center">
                <input
                  type="file"
                  id="report-file-upload"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="report-file-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Camera className="size-6 text-muted-foreground mb-1" />
                  <p className="text-xs font-medium text-foreground">
                    Click to upload photo evidence
                  </p>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG up to 10MB</p>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="relative flex items-center gap-2 rounded-sm bg-surface-2 px-2.5 py-1 text-xs"
                    >
                      <span className="truncate max-w-[140px] text-foreground">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-muted-foreground hover:text-crit"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-md border border-crit/30 bg-crit/10 px-3 py-2 text-xs text-crit">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p>{submitError}</p>
              </div>
            )}

            <div className="border-t border-border/70 pt-3">
              <Button
                type="submit"
                disabled={!details || details.length < 10 || submit.isPending || isUploading}
                className="w-full"
              >
                {isUploading
                  ? "Uploading evidence..."
                  : submit.isPending
                    ? "Submitting report..."
                    : "Submit Report"}
              </Button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
