import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
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
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface ExecutiveSettingsFormProps {
  onSaved?: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export function ExecutiveSettingsForm({ onSaved, onCancel, isModal = false }: ExecutiveSettingsFormProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current authenticated user & profile
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

      return {
        ...profile,
        authEmail: user.email,
      } as any;
    },
  });

  const rawRole = userProfile?.role || "EXECUTIVE";
  const formattedRole = rawRole.replace(/_/g, " ");

  // Dashboard options based on user role authorization
  const getAuthorizedDashboards = (role: string) => {
    switch (role) {
      case "PLATFORM_ADMIN":
        return [
          { value: "admin", label: "Admin Overview" },
          { value: "executive", label: "Executive Overview" },
          { value: "operations", label: "Operations Hub" },
          { value: "dark-stores", label: "Dark Stores Network" },
        ];
      case "EXECUTIVE":
        return [
          { value: "executive", label: "Executive Overview" },
          { value: "dark-stores", label: "Dark Stores Network" },
        ];
      case "OPERATIONS":
        return [
          { value: "operations", label: "Operations Hub" },
          { value: "dark-stores", label: "Dark Stores Network" },
        ];
      case "CUSTOMER_SUPPORT":
        return [{ value: "support", label: "Support Queue" }];
      case "STORE_MANAGER":
        return [{ value: "dark-stores", label: "My Store" }];
      default:
        return [{ value: "executive", label: "Executive Overview" }];
    }
  };

  const dashboardOptions = getAuthorizedDashboards(rawRole);
  const defaultDashboardValue = dashboardOptions[0]?.value || "executive";

  // Form State
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [defaultTimeRange, setDefaultTimeRange] = useState<"24h" | "7d" | "30d">("30d");
  const [defaultDashboard, setDefaultDashboard] = useState(defaultDashboardValue);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Notification Toggles State
  const [notifications, setNotifications] = useState({
    criticalOpsAlerts: true,
    majorFraudAlerts: true,
    slaBreachAlerts: true,
    dailyExecutiveSummary: true,
  });

  // Track initial loaded values to determine if user modified anything
  const [initialState, setInitialState] = useState<{
    fullName: string;
    location: string;
    defaultTimeRange: "24h" | "7d" | "30d";
    defaultDashboard: string;
    autoRefresh: boolean;
    notifications: {
      criticalOpsAlerts: boolean;
      majorFraudAlerts: boolean;
      slaBreachAlerts: boolean;
      dailyExecutiveSummary: boolean;
    };
  } | null>(null);

  useEffect(() => {
    if (userProfile) {
      const loadedFullName = userProfile.full_name || "";
      const loadedLocation = userProfile.hub_city || userProfile.city || "";
      const prefs = userProfile.preferences || {};
      const loadedTimeRange: "24h" | "7d" | "30d" = prefs.defaultTimeRange || "30d";
      const loadedDashboard = prefs.defaultDashboard || defaultDashboardValue;
      const loadedAutoRefresh = !!prefs.autoRefresh;
      const loadedNotifications = {
        criticalOpsAlerts: true,
        majorFraudAlerts: true,
        slaBreachAlerts: true,
        dailyExecutiveSummary: true,
        ...(prefs.notifications || {}),
      };

      setFullName(loadedFullName);
      setLocation(loadedLocation);
      setDefaultTimeRange(loadedTimeRange);
      setDefaultDashboard(loadedDashboard);
      setAutoRefresh(loadedAutoRefresh);
      setNotifications(loadedNotifications);

      setInitialState({
        fullName: loadedFullName,
        location: loadedLocation,
        defaultTimeRange: loadedTimeRange,
        defaultDashboard: loadedDashboard,
        autoRefresh: loadedAutoRefresh,
        notifications: loadedNotifications,
      });
    }
  }, [userProfile]);

  const hasChanges = initialState
    ? fullName !== initialState.fullName ||
      location !== initialState.location ||
      defaultTimeRange !== initialState.defaultTimeRange ||
      defaultDashboard !== initialState.defaultDashboard ||
      autoRefresh !== initialState.autoRefresh ||
      JSON.stringify(notifications) !== JSON.stringify(initialState.notifications)
    : false;

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const updatedPrefs = {
        ...(userProfile?.preferences || {}),
        defaultTimeRange,
        defaultDashboard,
        autoRefresh,
        notifications,
      };

      await fetchApi("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName,
          hub_city: location,
          preferences: updatedPrefs,
        }),
      });

      // Update local initial state to match newly saved state
      setInitialState({
        fullName,
        location,
        defaultTimeRange,
        defaultDashboard,
        autoRefresh,
        notifications,
      });

      // Invalidate relevant queries to reflect changes completely
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["settings-user-profile"] });

      toast.success("Settings saved successfully", {
        description: "Your profile and operational preferences have been updated.",
      });

      if (onSaved) onSaved();
    } catch (error: any) {
      toast.error("Failed to save settings", {
        description: error.message || "An unexpected error occurred while saving.",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        <RefreshCw className="mr-2 size-4 animate-spin text-primary" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${isModal ? "" : "max-w-4xl"}`}>
      {/* 1. Profile Section */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <User className="size-4 text-primary" /> Profile
            </span>
          }
          subtitle="Manage your identity details"
        />
        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="exec-fullname" className="text-xs font-medium">
                Full Name
              </Label>
              <Input
                id="exec-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="bg-surface text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exec-role" className="text-xs font-medium">
                Role (Read-only)
              </Label>
              <Input
                id="exec-role"
                value={formattedRole}
                disabled
                readOnly
                className="bg-surface-3 text-muted-foreground cursor-not-allowed font-medium text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Role and permissions are assigned by administrator.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="exec-location" className="text-xs font-medium">
              Location / Primary Hub
            </Label>
            <Input
              id="exec-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Bengaluru, National HQ"
              className="bg-surface text-sm"
            />
          </div>
        </div>
      </Panel>

      {/* 2. Dashboard Preferences Section */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <LayoutDashboard className="size-4 text-primary" /> Dashboard Preferences
            </span>
          }
          subtitle="Customize your default command center view"
        />
        <div className="p-5 space-y-5 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Time Range</Label>
              <Select
                value={defaultTimeRange}
                onValueChange={(v: "24h" | "7d" | "30d") => setDefaultTimeRange(v)}
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

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Dashboard</Label>
              <Select
                value={defaultDashboard}
                onValueChange={(v) => setDefaultDashboard(v)}
              >
                <SelectTrigger className="bg-surface">
                  <SelectValue placeholder="Select dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {dashboardOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-md border border-border p-3 bg-surface-2/40">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                Auto-refresh dashboard data
              </Label>
              <p className="text-xs text-muted-foreground">
                Periodically fetch live operational signals every 30 seconds.
              </p>
            </div>
            <Switch
              checked={autoRefresh}
              onCheckedChange={(v) => setAutoRefresh(v)}
            />
          </div>
        </div>
      </Panel>

      {/* 3. Notifications Section */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <Bell className="size-4 text-primary" /> Notifications
            </span>
          }
          subtitle="Configure high-priority executive operational alerts"
        />
        <div className="p-5 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Critical operational alerts</Label>
              <p className="text-xs text-muted-foreground">
                Receive notifications when store PulseScore drops below critical thresholds.
              </p>
            </div>
            <Switch
              checked={notifications.criticalOpsAlerts}
              onCheckedChange={(v) =>
                setNotifications((prev) => ({ ...prev, criticalOpsAlerts: v }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Major fraud alerts</Label>
              <p className="text-xs text-muted-foreground">
                Get notified for high-confidence refund fraud detection triggers.
              </p>
            </div>
            <Switch
              checked={notifications.majorFraudAlerts}
              onCheckedChange={(v) =>
                setNotifications((prev) => ({ ...prev, majorFraudAlerts: v }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">SLA breach alerts</Label>
              <p className="text-xs text-muted-foreground">
                Alerts when Priority 1 customer issues breach target resolution times.
              </p>
            </div>
            <Switch
              checked={notifications.slaBreachAlerts}
              onCheckedChange={(v) =>
                setNotifications((prev) => ({ ...prev, slaBreachAlerts: v }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Daily executive summary</Label>
              <p className="text-xs text-muted-foreground">
                Receive a daily digest summarizing network-wide KPIs and key incidents.
              </p>
            </div>
            <Switch
              checked={notifications.dailyExecutiveSummary}
              onCheckedChange={(v) =>
                setNotifications((prev) => ({ ...prev, dailyExecutiveSummary: v }))
              }
            />
          </div>
        </div>
      </Panel>

      {/* 4. Account & Security Section */}
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
              <p className="text-xs font-medium text-muted-foreground">Signed-in Identity</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {userProfile?.email || userProfile?.authEmail || "authenticated_user"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assigned Role</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formattedRole}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-border bg-surface-2/50 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
            <Lock className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-foreground">Managed Authentication</span>
              <p className="mt-0.5">
                Authentication and credentials are securely managed through the existing DarkOps/Supabase identity provider.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center pt-1">
            <div className="text-xs text-muted-foreground">
              Need to switch accounts or end session?
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

      {/* Save Action Footer */}
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
