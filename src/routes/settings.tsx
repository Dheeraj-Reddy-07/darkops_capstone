import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ExecutiveSettingsForm } from "@/components/settings/executive-settings-form";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings - DarkOps" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Executive Settings"
        subtitle="Manage identity details, dashboard defaults, notifications, and security options."
      />
      <div className="mt-4 pb-12">
        <ExecutiveSettingsForm />
      </div>
    </>
  );
}
