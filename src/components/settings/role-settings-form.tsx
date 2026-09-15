import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { normalizeRole } from "@/lib/auth-utils";
import { readPreferences, type TimeRange, type SupportQueue } from "@/lib/preferences";
import { getSettingsConfig } from "@/lib/settings-config";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Lock,
  User,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  Check,
  RefreshCw,
  Clock,
  Inbox,
  Info,
  ChevronRight,
  Store,
} from "lucide-react";

interface RoleSettingsFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export function RoleSettingsForm({ onSaved, onCancel, isModal = false }: RoleSettingsFormProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const { data: userProfile, isLoading } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return { ...profile, authEmail: user.email } as any;
    },
  });

  // ── Form state ──────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [defaultTimeRange, setDefaultTimeRange] = useState<TimeRange>("30d");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [supportQueue, setSupportQueue] = useState<SupportQueue>("mine");
  const [supportAutoRefresh, setSupportAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});
  const [initial, setInitial] = useState<string | null>(null);

  const role = normalizeRole(userProfile?.role) || (userProfile?.role as any);
  const formattedRole = role ? String(role).replace(/_/g, " ") : "";
  const isLead = userProfile?.email === "support@darkops.com" || userProfile?.id === "usr-supp-001";
  const config = role ? getSettingsConfig(role as any, { isLead }) : null;

  useEffect(() => {
    if (!userProfile || !config) return;
    const prefs = readPreferences(userProfile);
    const loadedName = userProfile.full_name || "";
    const loadedLocation = userProfile.hub_city || userProfile.city || "";
    const loadedTimeRange: TimeRange = prefs.defaultTimeRange || "30d";
    const loadedAutoRefresh = !!prefs.autoRefresh;
    const loadedQueue: SupportQueue = prefs.supportDefaultQueue || (isLead ? "team" : "mine");
    const loadedSupportRefresh = prefs.supportAutoRefresh !== false; // default on
    const notifItems = config.notifications?.items || [];
    const loadedNotifications: Record<string, boolean> = {};
    for (const item of notifItems) {
      loadedNotifications[item.key] = prefs.notifications?.[item.key] ?? true;
    }

    setFullName(loadedName);
    setLocation(loadedLocation);
    setDefaultTimeRange(loadedTimeRange);
    setAutoRefresh(loadedAutoRefresh);
    setSupportQueue(loadedQueue);
    setSupportAutoRefresh(loadedSupportRefresh);
    setNotifications(loadedNotifications);
    setInitial(
      JSON.stringify({
        loadedName,
        loadedLocation,
        loadedTimeRange,
        loadedAutoRefresh,
        loadedQueue,
        loadedSupportRefresh,
        loadedNotifications,
      }),
    );
  }, [userProfile, config, isLead]);

  const current = JSON.stringify({
    loadedName: fullName,
    loadedLocation: location,
    loadedTimeRange: defaultTimeRange,
    loadedAutoRefresh: autoRefresh,
    loadedQueue: supportQueue,
    loadedSupportRefresh: supportAutoRefresh,
    loadedNotifications: notifications,
  });
  const hasChanges = initial !== null && current !== initial;

  const handleSave = async () => {
    if (!hasChanges || !config) return;
    setIsSaving(true);
    try {
      const existing = readPreferences(userProfile);
      const updatedPrefs: Record<string, any> = { ...existing };

      if (config.dashboard?.timeRange) updatedPrefs["defaultTimeRange"] = defaultTimeRange;
      if (config.dashboard?.autoRefresh) updatedPrefs["autoRefresh"] = autoRefresh;
      if (config.queue) {
        updatedPrefs["supportDefaultQueue"] = supportQueue;
        updatedPrefs["supportAutoRefresh"] = supportAutoRefresh;
      }
      if (config.notifications) {
        updatedPrefs["notifications"] = { ...(existing.notifications || {}), ...notifications };
      }

      await fetchApi("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName,
          hub_city: location,
          preferences: updatedPrefs,
        }),
      });

      setInitial(current);
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["current-user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["settings-user-profile"] });

      toast.success("Settings saved", {
        description: "Your preferences have been updated.",
      });
      onSaved?.();
    } catch (error: any) {
      toast.error("Failed to save settings", {
        description: error?.message || "An unexpected error occurred while saving.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/login" });
  };

  if (isLoading || !config) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        <RefreshCw className="mr-2 size-4 animate-spin text-primary" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isModal ? "" : "max-w-4xl"}`}>
      {/* Profile */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <User className="size-4 text-primary" /> Profile
            </span>
          }
          subtitle="Your identity details"
        />
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-fullname" className="text-xs font-medium">
                Full Name
              </Label>
              <Input
                id="settings-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="bg-surface text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-role" className="text-xs font-medium">
                Role (Read-only)
              </Label>
              <Input
                id="settings-role"
                value={formattedRole}
                disabled
                readOnly
                className="bg-surface-3 text-muted-foreground cursor-not-allowed font-medium text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Role and permissions are assigned by an administrator.
              </p>
            </div>
          </div>

          {config.identity.locationLabel && (
            <div className="space-y-1.5">
              <Label htmlFor="settings-location" className="text-xs font-medium">
                {config.identity.locationLabel}
              </Label>
              <Input
                id="settings-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bengaluru"
                className="bg-surface text-sm"
              />
            </div>
          )}

          {config.identity.showStoreScope && (
            <div className="rounded-md border border-border bg-surface-2/50 p-3 text-xs flex items-start gap-2.5">
              <Store className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Assigned store</span>
                <p className="mt-0.5 text-muted-foreground">
                  {userProfile?.store_id
                    ? `Your account is scoped to store ${userProfile.store_id}.`
                    : "You are not currently scoped to a specific store."}
                </p>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Dashboard / Monitoring preferences */}
      {config.dashboard && (
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <LayoutDashboard className="size-4 text-primary" /> {config.dashboard.heading}
              </span>
            }
            subtitle={config.dashboard.subtitle}
          />
          <div className="p-5 space-y-5 text-sm">
            {config.dashboard.timeRange && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Default time range</Label>
                  <Select
                    value={defaultTimeRange}
                    onValueChange={(v: TimeRange) => setDefaultTimeRange(v)}
                  >
                    <SelectTrigger className="bg-surface">
                      <SelectValue placeholder="Select time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {config.dashboard.autoRefresh && (
              <div className="flex items-center justify-between rounded-md border border-border p-3 bg-surface-2/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {config.dashboard.autoRefreshLabel}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {config.dashboard.autoRefreshDesc}
                  </p>
                </div>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Support queue preferences */}
      {config.queue && (
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <Inbox className="size-4 text-primary" /> {config.queue.heading}
              </span>
            }
            subtitle={config.queue.subtitle}
          />
          <div className="p-5 space-y-5 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{config.queue.queueLabel}</Label>
                <Select
                  value={supportQueue}
                  onValueChange={(v: SupportQueue) => setSupportQueue(v)}
                >
                  <SelectTrigger className="bg-surface">
                    <SelectValue placeholder="Select default queue" />
                  </SelectTrigger>
                  <SelectContent>
                    {config.queue.queueOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{config.queue.queueDesc}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3 bg-surface-2/40">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />
                  {config.queue.autoRefreshLabel}
                </Label>
                <p className="text-xs text-muted-foreground">{config.queue.autoRefreshDesc}</p>
              </div>
              <Switch checked={supportAutoRefresh} onCheckedChange={setSupportAutoRefresh} />
            </div>

            <Separator />

            <div className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2/30 p-3 text-xs">
              <Info className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">
                  {config.queue.assignmentInfo.label}
                </span>
                <p className="mt-0.5 text-muted-foreground">{config.queue.assignmentInfo.desc}</p>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Platform administration (admin only, informational links) */}
      {config.admin && (
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" /> {config.admin.heading}
              </span>
            }
            subtitle={config.admin.subtitle}
          />
          <div className="p-3 space-y-1.5 text-sm">
            {config.admin.links.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => navigate({ to: link.to })}
                className="w-full flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2/40 p-3 text-left hover:bg-surface-3 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{link.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* Notifications */}
      {config.notifications && (
        <Panel>
          <PanelHeader
            title={
              <span className="flex items-center gap-2">
                <Bell className="size-4 text-primary" /> {config.notifications.heading}
              </span>
            }
            subtitle={config.notifications.subtitle}
          />
          <div className="p-5 space-y-4 text-sm">
            {config.notifications.items.map((item, idx) => (
              <div key={item.key}>
                {idx > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{item.label}</Label>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={notifications[item.key] ?? true}
                    onCheckedChange={(v) =>
                      setNotifications((prev) => ({ ...prev, [item.key]: v }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Account & Security */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Account & Security
            </span>
          }
          subtitle="Authentication context and account actions"
        />
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Signed-in identity</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {userProfile?.email || userProfile?.authEmail || "authenticated_user"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assigned role</p>
              <p className="mt-1 text-sm font-medium text-foreground">{formattedRole}</p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface-2/50 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
            <Lock className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-foreground">Managed authentication</span>
              <p className="mt-0.5">
                Authentication and credentials are securely managed through the DarkOps / Supabase
                identity provider.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center pt-1">
            <div className="text-xs text-muted-foreground">
              Need to switch accounts or end your session?
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-crit border-crit/30 hover:bg-crit/10 hover:text-crit h-8 text-xs gap-1.5"
            >
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </div>
        </div>
      </Panel>

      {/* Save footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
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
              <Check className="size-4" /> Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
