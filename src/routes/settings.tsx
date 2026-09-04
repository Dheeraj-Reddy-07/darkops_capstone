import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Lock, User, Monitor, Send, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings - DarkOps" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['settings-user-profile'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      return profile;
    },
  });

  // Default preferences struct
  const defaultPrefs = {
    timezone: "ist",
    defaultView: "network",
    defaultHorizon: "today",
    compactMode: false,
    pulseThreshold: 70,
    pulseInApp: true,
    pulseEmail: true,
    slaAlert: true,
    fraudAlert: true,
    oooMode: false,
    delegateTo: "jdoe",
  };

  const [initialPrefs, setInitialPrefs] = useState(defaultPrefs);
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => {
    if (userProfile?.preferences && Object.keys(userProfile.preferences).length > 0) {
      const mergedPrefs = { ...defaultPrefs, ...userProfile.preferences };
      setInitialPrefs(mergedPrefs);
      setPrefs(mergedPrefs);
    }
  }, [userProfile]);

  const hasChanges = JSON.stringify(prefs) !== JSON.stringify(initialPrefs);

  const updatePref = (key: string, value: any) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetchApi('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferences: prefs })
      });
      
      setInitialPrefs(prefs);
      queryClient.invalidateQueries({ queryKey: ['settings-user-profile'] });
      
      toast.success("Settings saved successfully", {
        description: "Your preferences have been updated.",
      });
    } catch (error: any) {
      toast.error("Failed to save settings", {
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading settings...</div>;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, alerts, and operational preferences."
        right={
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} className="text-xs h-8">
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        }
      />
      
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl pb-10">
        
        {/* Left Column - Identity & Security */}
        <div className="space-y-6">
          <Panel>
            <PanelHeader 
              title={<span className="flex items-center gap-2"><User className="size-4" /> Profile & Identity</span>} 
            />
            <div className="p-5 space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue={userProfile?.full_name || ''} disabled className="bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Role (Read-only)</Label>
                <Input id="role" value={userProfile?.role?.replace('_', ' ') || ''} disabled className="bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Primary Hub / Location</Label>
                <Input id="location" defaultValue={userProfile?.hub_city || userProfile?.city || ''} disabled className="bg-surface-2" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={prefs.timezone} onValueChange={(v) => updatePref('timezone', v)}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ist">India Standard Time (IST)</SelectItem>
                    <SelectItem value="utc">Coordinated Universal Time (UTC)</SelectItem>
                    <SelectItem value="pst">Pacific Standard Time (PST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader 
              title={<span className="flex items-center gap-2"><Lock className="size-4" /> Security</span>} 
            />
            <div className="p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Password</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Last changed 45 days ago</div>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs">Update</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Two-Factor Authentication</div>
                  <div className="text-xs text-ok mt-0.5 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-ok" /> Enabled
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs">Manage</Button>
              </div>
            </div>
          </Panel>
        </div>

        {/* Middle & Right Column - Operations */}
        <div className="md:col-span-2 space-y-6">
          <Panel>
            <PanelHeader 
              title={<span className="flex items-center gap-2"><Monitor className="size-4" /> Dashboard Preferences</span>} 
            />
            <div className="p-5 space-y-6 text-sm">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label>Default View</Label>
                  <Select value={prefs.defaultView} onValueChange={(v) => updatePref('defaultView', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="network">Network Overview (All Hubs)</SelectItem>
                      <SelectItem value="regional">Regional Only (My Hub)</SelectItem>
                      <SelectItem value="escalations">Escalations Queue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Default Time Horizon</Label>
                  <Select value={prefs.defaultHorizon} onValueChange={(v) => updatePref('defaultHorizon', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select horizon" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today (Live)</SelectItem>
                      <SelectItem value="24h">Last 24 Hours</SelectItem>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Compact Table Mode</Label>
                  <p className="text-xs text-muted-foreground">Condense rows to fit more data on screen.</p>
                </div>
                <Switch checked={prefs.compactMode} onCheckedChange={(v) => updatePref('compactMode', v)} />
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader 
              title={<span className="flex items-center gap-2"><Bell className="size-4" /> Alerts & Notifications</span>} 
            />
            <div className="p-5 space-y-6 text-sm">
              {/* Store Pulse */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Store Pulse Threshold</Label>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-surface-3 rounded-sm">{prefs.pulseThreshold}</span>
                </div>
                <p className="text-xs text-muted-foreground">Alert me when a store's operational pulse drops below this value.</p>
                <div className="pt-2">
                  <Slider 
                    value={[prefs.pulseThreshold]} 
                    onValueChange={(v) => updatePref('pulseThreshold', v[0])} 
                    max={100} 
                    step={1}
                    className="cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pulse-app" checked={prefs.pulseInApp} onCheckedChange={(v) => updatePref('pulseInApp', !!v)} />
                    <label htmlFor="pulse-app" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">In-app</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="pulse-email" checked={prefs.pulseEmail} onCheckedChange={(v) => updatePref('pulseEmail', !!v)} />
                    <label htmlFor="pulse-email" className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* SLA & Fraud Alerts */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-warn">P1 SLA Risk Alerts</Label>
                    <p className="text-xs text-muted-foreground">Notify when a Priority 1 case is within 30 mins of breaching SLA.</p>
                  </div>
                  <Switch checked={prefs.slaAlert} onCheckedChange={(v) => updatePref('slaAlert', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-crit">Fraud & Risk Escalations</Label>
                    <p className="text-xs text-muted-foreground">Notify immediately for high-confidence (&gt;90%) fraud detections.</p>
                  </div>
                  <Switch checked={prefs.fraudAlert} onCheckedChange={(v) => updatePref('fraudAlert', v)} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader 
              title={<span className="flex items-center gap-2"><Send className="size-4" /> Delegation & OOO</span>} 
            />
            <div className="p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border p-3 bg-surface-2/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Out of Office Mode</Label>
                  <p className="text-xs text-muted-foreground">Route high-priority escalations to a delegate.</p>
                </div>
                <Switch checked={prefs.oooMode} onCheckedChange={(v) => updatePref('oooMode', v)} />
              </div>
              
              <div className={`space-y-1.5 transition-opacity ${prefs.oooMode ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <Label>Delegate Approvals To</Label>
                <Select value={prefs.delegateTo} onValueChange={(v) => updatePref('delegateTo', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delegate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jdoe">Jane Doe (VP Operations)</SelectItem>
                    <SelectItem value="msmith">Mike Smith (Regional Director)</SelectItem>
                    <SelectItem value="tlee">Tom Lee (Risk Manager)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
