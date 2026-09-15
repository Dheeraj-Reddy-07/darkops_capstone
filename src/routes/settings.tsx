import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { RoleSettingsForm } from "@/components/settings/role-settings-form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeRole } from "@/lib/auth-utils";
import { getSettingsConfig } from "@/lib/settings-config";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings - DarkOps" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
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

  const role = normalizeRole(userProfile?.role) || (userProfile?.role as any);

  // Customers have a dedicated, customer-oriented account experience.
  if (role === "CUSTOMER") {
    return <Navigate to="/customer/profile" replace />;
  }

  if (isLoading || !role) {
    return (
      <div className="flex h-64 w-full items-center justify-center text-sm text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  const isLead = userProfile?.email === "support@darkops.com" || userProfile?.id === "usr-supp-001";
  const config = getSettingsConfig(role, { isLead });

  return (
    <>
      <PageHeader title={config.title} subtitle={config.subtitle} />
      <div className="mt-4 pb-12">
        <RoleSettingsForm />
      </div>
    </>
  );
}
