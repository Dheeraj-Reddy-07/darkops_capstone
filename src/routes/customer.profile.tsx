import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  ShoppingBag,
  MessageSquare,
  LogOut,
  ArrowRight,
  MapPin,
  Phone,
  Calendar,
} from "lucide-react";
import { Panel, PanelHeader } from "@/components/ops/primitives";
import { useCustomerOrders, useCustomerComplaints } from "@/hooks/useCustomer";
import { inr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { format } from "date-fns";

export const Route = createFileRoute("/customer/profile")({
  head: () => ({
    meta: [
      { title: "Profile - DarkOps Care" },
      {
        name: "description",
        content: "Your account details, order history, and support history.",
      },
      { property: "og:title", content: "Profile - DarkOps Care" },
      {
        property: "og:description",
        content: "Account details and activity history.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { data: orders } = useCustomerOrders();
  const { data: complaints } = useCustomerComplaints();

  // Fetch customer profile data
  const { data: profile } = useQuery({
    queryKey: ["customer-profile-details"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("customers")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      const customerData = data as any;
      return customerData;
    },
  });

  const totalSpent = orders?.reduce((sum, o) => sum + o.total, 0) || 0;
  const resolvedComplaints =
    complaints?.filter((c: any) => c.status === "resolved" || c.status === "closed").length || 0;

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer">
            <ArrowRight className="mr-2 size-4 rotate-180" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Your account</h1>
          <p className="text-xs text-muted-foreground">
            Manage your account details and view your activity history
          </p>
        </div>
      </div>

      {/* Account Details */}
      <Panel>
        <PanelHeader title="Account details" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <User className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[13px]">Name</p>
              <p className="mt-0.5 text-sm">{profile?.full_name || "Not set"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[13px]">Phone</p>
              <p className="mt-0.5 text-sm">{profile?.phone || "Not set"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[13px]">City</p>
              <p className="mt-0.5 text-sm">{profile?.city || "Not set"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[13px]">Member since</p>
              <p className="mt-0.5 text-sm">
                {profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "Not set"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShoppingBag className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-[13px]">Account standing</p>
              <p className="mt-0.5 text-sm capitalize">{profile?.account_standing || "Good"}</p>
            </div>
          </div>
        </div>
      </Panel>

      {/* Activity Summary */}
      <Panel>
        <PanelHeader title="Activity summary" />
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="text-center">
            <p className="text-2xl font-semibold">{orders?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total orders</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{inr(totalSpent)}</p>
            <p className="text-xs text-muted-foreground">Total spent</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold">{complaints?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Complaints filed</p>
          </div>
        </div>
      </Panel>

      {/* Recent Orders */}
      <Panel>
        <PanelHeader
          title="Recent orders"
          subtitle="Last 5 orders"
          right={
            orders &&
            orders.length > 5 && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/customer/orders">View all</Link>
              </Button>
            )
          }
        />
        <ul className="divide-y divide-border/60">
          {orders?.slice(0, 5).map((o) => (
            <li key={o.id}>
              <Link
                to="/customer/orders/$id"
                params={{ id: o.id }}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
              >
                <div>
                  <p className="num text-[13px]">{o.id}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{o.itemsPreview}</p>
                </div>
                <span className="num text-[13px]">{inr(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Support History */}
      <Panel>
        <PanelHeader
          title="Support history"
          subtitle="Last 5 complaints"
          right={
            complaints &&
            complaints.length > 5 && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/customer/complaints">View all</Link>
              </Button>
            )
          }
        />
        <ul className="divide-y divide-border/60">
          {complaints?.slice(0, 5).map((c: any) => (
            <li key={c.id}>
              <Link
                to="/customer/complaints/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
              >
                <div>
                  <p className="num text-[13px]">{c.complaintRef}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.summary}</p>
                </div>
                <span className="text-[13px] capitalize">{c.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Logout */}
      <Panel>
        <div className="p-4">
          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </div>
      </Panel>
    </div>
  );
}
