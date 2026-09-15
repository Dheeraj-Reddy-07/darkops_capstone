import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  LogOut,
  ArrowRight,
  MapPin,
  Phone,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { useCustomerOrders, useCustomerComplaints, useCustomerProfile } from "@/hooks/useCustomer";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CustomerNotificationPreferences } from "@/components/settings/customer-notification-preferences";
import { format } from "date-fns";

export const Route = createFileRoute("/customer/profile")({
  head: () => ({
    meta: [
      { title: "Profile - DarkOps Care" },
      {
        name: "description",
        content: "Your account details, order history, recent issues, and privacy information.",
      },
      { property: "og:title", content: "Profile - DarkOps Care" },
      {
        property: "og:description",
        content: "Account details, activity history, and privacy information.",
      },
    ],
  }),
  component: Profile,
});

function getCustomerFriendlyStatus(c: any) {
  if (c.customerStatusLabel) return c.customerStatusLabel;
  const rawStatus = (c.status || "").toLowerCase();
  const statusMap: Record<string, string> = {
    received: "Received: being processed",
    unassigned: "Received: being processed",
    agent_queue: "Under review",
    assigned: "Under review by support team",
    in_progress: "Under review by support team",
    auto_resolved: "Resolved",
    resolved: "Resolved",
    closed: "Resolved",
    sla_expired: "Support available",
    awaiting_customer: "Awaiting your response",
  };
  return statusMap[rawStatus] || "Under review";
}

function Profile() {
  const { data: orders } = useCustomerOrders();
  const { data: complaints } = useCustomerComplaints();
  const { data: profile, isLoading: profileLoading } = useCustomerProfile();

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="w-full space-y-5 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer">
            <ArrowRight className="mr-2 size-4 rotate-180" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Account Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage your account and issue updates, view your history, and understand how your data
            is handled.
          </p>
        </div>
      </div>

      {/* Account Identity */}
      <Panel>
        <PanelHeader
          title="Customer Identity"
          subtitle="Identity details synchronized from upstream commerce platform"
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <User className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-foreground">Customer Name</p>
              <p className="mt-0.5 text-sm text-foreground font-semibold">
                {profileLoading ? "Loading..." : profile?.full_name || profile?.email || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-foreground">Account Created</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "—"}
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-border/70 bg-surface-2/30 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Customer registration and profile details are owned by the upstream commerce platform.
          </span>
          <span className="text-[11px] font-medium text-primary">Read-only Identity</span>
        </div>
      </Panel>

      {/* Activity Summary */}
      <Panel>
        <PanelHeader title="Activity summary" />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="text-center p-3 rounded-md bg-surface-2/40">
            <p className="text-2xl font-semibold">{orders?.length || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Orders</p>
          </div>
          <div className="text-center p-3 rounded-md bg-surface-2/40">
            <p className="text-2xl font-semibold">{complaints?.length || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Issues reported</p>
          </div>
          <div className="text-center p-3 rounded-md bg-surface-2/40">
            <p className="text-2xl font-semibold text-warn">
              {complaints?.filter((c: any) => c.status !== "resolved" && c.status !== "closed")
                .length || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Active issues</p>
          </div>
        </div>
      </Panel>

      {/* Recent Orders */}
      <Panel>
        <PanelHeader
          title="Recent orders"
          subtitle="Your latest order history"
          right={
            orders &&
            orders.length > 5 && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/customer/orders">View all</Link>
              </Button>
            )
          }
        />
        {orders && orders.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link
                  to="/customer/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
                >
                  <div>
                    <p className="num text-[13px] font-medium">Order #{o.id}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{o.itemsPreview}</p>
                  </div>
                  <span className="num text-[13px] font-semibold">{inr(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-xs text-muted-foreground text-center">No orders found.</div>
        )}
      </Panel>

      {/* My Recent Issues */}
      <Panel>
        <PanelHeader
          title="My recent issues"
          subtitle="Your latest reported issues"
          right={
            complaints &&
            complaints.length > 5 && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/customer/complaints">View all</Link>
              </Button>
            )
          }
        />
        {complaints && complaints.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {complaints.slice(0, 5).map((c: any) => (
              <li key={c.id}>
                <Link
                  to="/customer/complaints/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
                >
                  <div>
                    <p className="num text-[13px] font-medium">{c.complaintRef}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.summary}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-sm bg-surface-3">
                    {getCustomerFriendlyStatus(c)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No reported issues found.
          </div>
        )}
      </Panel>

      {/* Notification Preferences */}
      <CustomerNotificationPreferences />

      {/* Privacy & Data */}
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Privacy & Data
            </span>
          }
          subtitle="How your information is stored and protected"
        />
        <div className="p-5 space-y-5 text-xs text-muted-foreground leading-relaxed">
          <div className="rounded-md border border-border bg-surface-2/40 p-3.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="size-3.5 text-primary" /> Your data
            </h3>
            <p className="mt-1 text-xs text-foreground/90 font-medium">
              DarkOps stores information needed to process your orders, reported issues, and support
              requests.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 border border-border/70 rounded-md p-3.5 bg-surface-2/20">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">
                Information We Store
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-muted-foreground">
                <li>Account and profile details</li>
                <li>Order information needed to investigate reported issues</li>
                <li>Issues and complaints submitted by you</li>
                <li>Issue tracking and resolution history</li>
                <li>Evidence or attachments submitted with your reports</li>
              </ul>
            </div>

            <div className="space-y-2 border border-border/70 rounded-md p-3.5 bg-surface-2/20">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wide">
                How We Use Information
              </p>
              <ul className="space-y-1.5 list-disc list-inside text-muted-foreground">
                <li>Process and resolve reported issues</li>
                <li>Provide dedicated customer support</li>
                <li>Display your own order and issue history</li>
                <li>Prevent abuse and protect service integrity</li>
                <li>Improve operational service reliability</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-primary/5 p-3 text-foreground">
            <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs">
              <span className="font-semibold">Data Protection Boundary:</span> Customer information
              is restricted to your authenticated account and authorized systems/personnel involved
              in processing your relevant support and operational workflow.
            </p>
          </div>
        </div>
      </Panel>

      {/* Logout */}
      <Panel>
        <div className="p-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full text-crit hover:bg-crit/10 hover:text-crit border-crit/30"
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
      </Panel>
    </div>
  );
}
