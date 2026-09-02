import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, KpiCard } from "@/components/ops/primitives";
import { useCustomerOrders, useCustomerComplaints } from "@/hooks/useCustomer";
import { num } from "@/lib/utils";
import { format } from "date-fns";

export const Route = createFileRoute("/customer/profile")({
  head: () => ({
    meta: [
      { title: "My Profile - DarkOps" },
      {
        name: "description",
        content: "View your order history, complaints, and account details.",
      },
    ],
  }),
  component: CustomerProfile,
});

function CustomerProfile() {
  const { data: orders, isLoading: ordersLoading } = useCustomerOrders();
  const { data: complaints, isLoading: complaintsLoading } = useCustomerComplaints();

  if (ordersLoading || complaintsLoading) {
    return <div className="p-8">Loading profile...</div>;
  }

  const totalOrders = orders?.length || 0;
  const totalSpent = orders?.reduce((sum: number, o: any) => sum + o.total, 0) || 0;
  const totalComplaints = complaints?.length || 0;
  const resolvedComplaints = complaints?.filter((c: any) => c.status === 'resolved').length || 0;

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Order history, complaints, and account information"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Orders" value={totalOrders} footnote="all time" />
        <KpiCard label="Total Spent" value={num(totalSpent)} unit="₹" footnote="lifetime value" />
        <KpiCard label="Complaints Filed" value={totalComplaints} footnote="support requests" />
        <KpiCard label="Resolved Issues" value={resolvedComplaints} footnote="successfully closed" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Recent Orders" subtitle="Your latest purchases" />
          <div className="p-4">
            {orders && orders.length > 0 ? (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0">
                    <div>
                      <p className="num text-sm font-medium">{order.id}</p>
                      <p className="text-xs text-muted-foreground">{order.storeName}</p>
                      <p className="text-xs text-muted-foreground">{order.placedAt}</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-sm font-medium">₹{num(order.total)}</p>
                      <p className="text-xs text-muted-foreground">{order.items} items</p>
                      <p className="text-xs text-muted-foreground">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Support History" subtitle="Your complaints and resolutions" />
          <div className="p-4">
            {complaints && complaints.length > 0 ? (
              <div className="space-y-3">
                {complaints.slice(0, 5).map((complaint: any) => (
                  <div key={complaint.id} className="border-b border-border/70 pb-3 last:border-0">
                    <div className="flex items-center justify-between">
                      <p className="num text-sm font-medium">{complaint.complaintRef}</p>
                      <p className="text-xs text-muted-foreground">{complaint.createdAt}</p>
                    </div>
                    <p className="mt-1 text-sm">{complaint.summary}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{complaint.category}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{complaint.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No complaints filed.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-3">
        <PanelHeader title="Account Details" subtitle="Your profile information" />
        <div className="p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="label-caps">Email</p>
              <p className="mt-1 text-sm">customer@darkops.com</p>
            </div>
            <div>
              <p className="label-caps">Name</p>
              <p className="mt-1 text-sm">Test Customer</p>
            </div>
            <div>
              <p className="label-caps">City</p>
              <p className="mt-1 text-sm">Bengaluru</p>
            </div>
            <div>
              <p className="label-caps">Member Since</p>
              <p className="mt-1 text-sm">{format(new Date(), "MMM yyyy")}</p>
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
