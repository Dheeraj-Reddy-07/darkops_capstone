import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Check, RefreshCw } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { readPreferences } from "@/lib/preferences";
import { toast } from "sonner";

const CUSTOMER_NOTIFICATIONS = [
  {
    key: "issueUpdates",
    label: "Issue status updates",
    desc: "When the status of a reported issue changes.",
  },
  {
    key: "resolutionUpdates",
    label: "Resolution updates",
    desc: "When one of your issues is resolved.",
  },
  {
    key: "supportResponses",
    label: "Support responses",
    desc: "When our support team responds to you.",
  },
  {
    key: "orderIssueUpdates",
    label: "Important order & issue updates",
    desc: "Key updates about your orders and reported issues.",
  },
] as const;

/**
 * Customer-facing notification preferences. Persisted to the authenticated
 * customer's own profile via the self-scoped PATCH /auth/me endpoint.
 * Renders nothing when there is no authenticated Supabase session.
 */
export function CustomerNotificationPreferences() {
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});
  const [initial, setInitial] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data as any;
    },
  });

  useEffect(() => {
    if (!profile) return;
    const prefs = readPreferences(profile);
    const loaded: Record<string, boolean> = {};
    for (const item of CUSTOMER_NOTIFICATIONS) {
      loaded[item.key] = prefs.notifications?.[item.key] ?? true;
    }
    setNotifications(loaded);
    setInitial(JSON.stringify(loaded));
  }, [profile]);

  const current = JSON.stringify(notifications);
  const hasChanges = initial !== null && current !== initial;

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const existing = readPreferences(profile);
      await fetchApi("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          preferences: {
            ...existing,
            notifications: { ...(existing.notifications || {}), ...notifications },
          },
        }),
      });
      setInitial(current);
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Notification preferences saved");
    } catch (error: any) {
      toast.error("Could not save preferences", {
        description: error?.message || "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // No authenticated session (e.g. read-only handoff view) — hide the section.
  if (!isLoading && !profile) return null;

  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2">
            <Bell className="size-4 text-primary" /> Notification preferences
          </span>
        }
        subtitle="Choose which updates about your issues you want to receive"
      />
      <div className="p-5 space-y-4 text-sm">
        {CUSTOMER_NOTIFICATIONS.map((item, idx) => (
          <div key={item.key}>
            {idx > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={notifications[item.key] ?? true}
                onCheckedChange={(v) => setNotifications((prev) => ({ ...prev, [item.key]: v }))}
              />
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-1">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="size-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check className="size-4" /> Save preferences
              </>
            )}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
