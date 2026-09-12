import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, ArrowLeft, Camera, X } from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import { useCustomerOrders, useSubmitComplaint, useUploadAttachmentUrl } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/customer/support")({
  head: () => ({
    meta: [
      { title: "Report an issue - DarkOps Care" },
      {
        name: "description",
        content:
          "Report missing, wrong, or damaged items from your orders and get quick resolution.",
      },
      { property: "og:title", content: "Report an issue - DarkOps Care" },
      {
        property: "og:description",
        content: "Quick complaint filing for delivery issues.",
      },
    ],
  }),
  component: Support,
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

function Support() {
  const navigate = useNavigate();
  const { data: orders, isLoading, error } = useCustomerOrders();
  const submit = useSubmitComplaint();
  const uploadUrl = useUploadAttachmentUrl();

  // Read orderId and category from router location state if coming from order detail or shortcut
  const location = window.history.state;
  const preselectedOrderId = location?.usr?.orderId || "";
  const preselectedCategory = location?.usr?.category || "";

  // Multi-step form state
  const [step, setStep] = useState(preselectedOrderId ? 2 : 1);
  const [selectedOrder, setSelectedOrder] = useState(preselectedOrderId);
  const [category, setCategory] = useState(preselectedCategory);

  useEffect(() => {
    if (preselectedOrderId) {
      setSelectedOrder(preselectedOrderId);
      setStep(2);
    }
    if (preselectedCategory) {
      setCategory(preselectedCategory);
    }
  }, [preselectedOrderId, preselectedCategory]);
  const [details, setDetails] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsUploading(true);

    try {
      const attachmentMeta = [];

      for (const file of attachments) {
        // 1. Get signed upload URL
        const { data: uploadData } = await uploadUrl.mutateAsync({
          filename: file.name,
          content_type: file.type,
        });

        // 2. Upload file to Supabase Storage
        const uploadResponse = await fetch(uploadData.signedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        // 3. Save metadata
        attachmentMeta.push({
          filename: file.name,
          storage_path: uploadData.storagePath,
          file_type: file.type,
          file_size_bytes: file.size,
        });
      }

      // 4. Submit complaint
      submit.mutate(
        { order_id: selectedOrder, category, details, attachments: attachmentMeta },
        {
          onSuccess: (data) => {
            const complaint = data?.data;
            toast.success("Your issue has been received!", {
              description: `Reference: ${complaint?.complaint_ref || complaint?.id}`,
            });
            // Navigate to complaint detail page
            if (complaint?.id) {
              navigate({ to: "/customer/complaints/$id", params: { id: complaint.id } });
            } else {
              navigate({ to: "/customer/complaints" });
            }
          },
          onError: (err: any) => {
            console.error("[Support] Submit error:", err);
            const message =
              err?.message ||
              "Failed to submit issue. Please check your connection and try again.";
            setSubmitError(message);
            toast.error("Failed to submit issue", { description: message });
            setIsUploading(false);
          },
        },
      );
    } catch (err: any) {
      console.error("[Support] Upload error:", err);
      const message = err?.message || "Failed to upload attachments. Please try again.";
      setSubmitError(message);
      toast.error("Upload failed", { description: message });
      setIsUploading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && selectedOrder) setStep(2);
    else if (step === 2 && category) setStep(3);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading your orders...</div>
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

  const selectedOrderData = orders?.find((o) => o.id === selectedOrder);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Report an issue</h1>
          <p className="text-xs text-muted-foreground">
            Step {step} of 3:{" "}
            {step === 1 ? "Select order" : step === 2 ? "Choose issue" : "Add details"}
          </p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn("h-1 flex-1 rounded-full", s <= step ? "bg-primary" : "bg-border")}
          />
        ))}
      </div>

      {/* Step 1: Select Order */}
      {step === 1 && (
        <Panel>
          <PanelHeader title="Select order" subtitle="Choose the order with the issue" />
          <div className="p-4 space-y-2">
            {orders?.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrder(o.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded-sm border border-border px-4 py-3 text-left transition-colors",
                  selectedOrder === o.id ? "border-primary bg-primary/5" : "hover:bg-surface-2",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="num text-[13px]">{o.id}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{o.itemsPreview}</p>
                </div>
                <div className="ml-3 flex items-center gap-3">
                  <span className="num text-[13px]">{inr(o.total)}</span>
                  <StatusBadge status={o.status} />
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-border/70 px-4 py-3">
            <Button onClick={nextStep} disabled={!selectedOrder} className="w-full">
              Continue
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </Panel>
      )}

      {/* Step 2: Select Category */}
      {step === 2 && selectedOrderData && (
        <Panel>
          <PanelHeader
            title="What happened?"
            subtitle={`Order ${selectedOrderData.id} · ${selectedOrderData.storeName}`}
          />
          <div className="p-4 space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              {ISSUE_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={cn(
                    "flex flex-col items-start rounded-sm border border-border px-4 py-3 text-left transition-colors",
                    category === cat.key ? "border-primary bg-primary/5" : "hover:bg-surface-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{cat.icon}</span>
                    <p className="text-[13px] font-medium">{cat.label}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{cat.hint}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border/70 px-4 py-3 flex gap-2">
            <Button onClick={prevStep} variant="outline" className="flex-1">
              Back
            </Button>
            <Button onClick={nextStep} disabled={!category} className="flex-1">
              Continue
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </Panel>
      )}

      {/* Step 3: Add Details */}
      {step === 3 && selectedOrderData && category && (
        <Panel>
          <PanelHeader
            title="Tell us more"
            subtitle={`Order ${selectedOrderData.id} · ${ISSUE_CATEGORIES.find((c) => c.key === category)?.label}`}
          />
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[13px] font-medium">Describe what happened</label>
              <textarea
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  setSubmitError(null);
                }}
                placeholder="Please provide details about the issue..."
                className="w-full min-h-[120px] rounded-sm border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
                required
                minLength={10}
              />
              <p className="text-xs text-muted-foreground">
                {details.length} / 10 characters minimum
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium">Attach photos (optional)</label>
              <div className="border-2 border-dashed border-border rounded-sm p-4">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center cursor-pointer"
                >
                  <Camera className="size-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload photos</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="relative flex items-center gap-2 rounded-sm bg-surface-2 px-3 py-2"
                    >
                      <span className="text-xs truncate max-w-[150px]">{file.name}</span>
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

            <div className="border-t border-border/70 pt-4 flex flex-col gap-2">
              {submitError && (
                <div className="flex items-start gap-2 rounded-sm border border-crit/30 bg-crit/10 px-3 py-2">
                  <AlertCircle className="size-4 shrink-0 text-crit mt-0.5" />
                  <p className="text-xs text-crit">{submitError}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" onClick={prevStep} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={!details || details.length < 10 || submit.isPending || isUploading}
                  className="flex-1"
                >
                  {isUploading ? "Uploading files..." : submit.isPending ? "Submitting..." : "Submit issue"}
                </Button>
              </div>
            </div>
          </form>
        </Panel>
      )}
    </div>
  );
}
