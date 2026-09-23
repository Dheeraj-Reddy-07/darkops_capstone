// Role-aware settings configuration.
//
// Each authenticated persona gets a deliberately designed settings experience.
// This module maps a role (plus the support lead/agent distinction, which is a
// display-only split within the single CUSTOMER_SUPPORT role) to the exact
// sections, controls and copy that are relevant to that person's job.
//
// A section is only present in a config when it is genuinely relevant AND
// backed by real persistence or a real capability. Platform-controlled or
// non-configurable capabilities are expressed as informational rows, never as
// fake toggles.

import type { AppRole } from "@/types/auth";
import type { SupportQueue } from "@/lib/preferences";

export interface NotificationItem {
  /** Stable key persisted under preferences.notifications */
  key: string;
  label: string;
  desc: string;
}

export interface IdentityConfig {
  /** Label for the editable free-text location/hub field, or null to hide it. */
  locationLabel: string | null;
  /** Show the assigned store scope (read-only) — store manager only. */
  showStoreScope?: boolean;
}

export interface DashboardConfig {
  heading: string;
  subtitle: string;
  /** Expose the default time-range select (only where the dashboard honors it). */
  timeRange: boolean;
  /** Expose the auto-refresh toggle (only where the dashboard honors it). */
  autoRefresh: boolean;
  autoRefreshLabel: string;
  autoRefreshDesc: string;
}

export interface QueueConfig {
  heading: string;
  subtitle: string;
  queueLabel: string;
  queueDesc: string;
  queueOptions: { value: SupportQueue; label: string }[];
  autoRefreshLabel: string;
  autoRefreshDesc: string;
  /** Informational row describing platform-controlled auto-assignment. */
  assignmentInfo: { label: string; desc: string };
}

export interface AdminLink {
  label: string;
  desc: string;
  to: string;
}

export interface AdminConfig {
  heading: string;
  subtitle: string;
  links: AdminLink[];
}

export interface NotificationsConfig {
  heading: string;
  subtitle: string;
  items: NotificationItem[];
}

export interface SettingsConfig {
  title: string;
  subtitle: string;
  identity: IdentityConfig;
  dashboard?: DashboardConfig;
  queue?: QueueConfig;
  admin?: AdminConfig;
  notifications?: NotificationsConfig;
}

const ACCOUNT_COMMON = {
  identityBase: (locationLabel: string | null): IdentityConfig => ({ locationLabel }),
};

export function getSettingsConfig(role: AppRole, opts: { isLead?: boolean } = {}): SettingsConfig {
  switch (role) {
    case "EXECUTIVE":
      return {
        title: "Executive Settings",
        subtitle: "Manage your identity, dashboard defaults, and network-level alerts.",
        identity: ACCOUNT_COMMON.identityBase("Location / Primary hub"),
        dashboard: {
          heading: "Dashboard Preferences",
          subtitle: "Defaults applied to your executive dashboard.",
          timeRange: true,
          autoRefresh: true,
          autoRefreshLabel: "Auto-refresh dashboard data",
          autoRefreshDesc: "Refresh network signals on the executive dashboard every 30 seconds.",
        },
        notifications: {
          heading: "Executive Notifications",
          subtitle: "Choose which network-level alerts you receive.",
          items: [
            {
              key: "criticalOpsAlerts",
              label: "Critical operational alerts",
              desc: "When store PulseScore drops below critical thresholds.",
            },
            {
              key: "storeExceptionSpikes",
              label: "Store exception spikes",
              desc: "When store exception rates exceed baseline across the network.",
            },
            {
              key: "slaNetworkAlerts",
              label: "SLA & network performance",
              desc: "When Priority 1 issues breach network SLA targets.",
            },
            {
              key: "dailyDigest",
              label: "Daily executive digest",
              desc: "A daily summary of network KPIs and key incidents.",
            },
          ],
        },
      };

    case "OPERATIONS":
      return {
        title: "Operations Settings",
        subtitle: "Manage your identity, monitoring defaults, and operational alerts.",
        identity: ACCOUNT_COMMON.identityBase("Operational hub"),
        dashboard: {
          heading: "Monitoring Preferences",
          subtitle: "Defaults applied to your operations queue.",
          timeRange: false,
          autoRefresh: true,
          autoRefreshLabel: "Auto-refresh operations queue",
          autoRefreshDesc: "Refresh the live case queue every 30 seconds.",
        },
        notifications: {
          heading: "Operational Alerts",
          subtitle: "Choose which operational exceptions you receive.",
          items: [
            {
              key: "criticalStoreAlerts",
              label: "Critical store alerts",
              desc: "When a store enters a critical operational state.",
            },
            {
              key: "storeExceptionSpikes",
              label: "Store exception spikes",
              desc: "When exception rates exceed baseline across the network.",
            },
            {
              key: "equipmentExceptions",
              label: "Equipment & fulfillment exceptions",
              desc: "Equipment failures and fulfillment issues affecting throughput.",
            },
            {
              key: "slaOperationalAlerts",
              label: "SLA operational alerts",
              desc: "When high-priority cases approach or breach SLA.",
            },
          ],
        },
      };

    case "STORE_MANAGER":
      return {
        title: "Store Settings",
        subtitle: "Manage your identity and alerts for your store.",
        identity: { locationLabel: "Store location", showStoreScope: true },
        notifications: {
          heading: "Store Alerts",
          subtitle: "Choose which alerts for your store you receive.",
          items: [
            {
              key: "storeExceptions",
              label: "Store exceptions",
              desc: "Operational exceptions affecting your store.",
            },
            {
              key: "equipmentIssues",
              label: "Equipment issues",
              desc: "Equipment failures and maintenance work orders.",
            },
            {
              key: "inventoryIssues",
              label: "Inventory & stock issues",
              desc: "Low stock and inventory accuracy problems.",
            },
            {
              key: "deliveryDelays",
              label: "Delivery delays",
              desc: "Delivery delays originating from your store.",
            },
            {
              key: "highPriorityComplaints",
              label: "High-priority complaints",
              desc: "Priority 1 customer issues linked to your store.",
            },
          ],
        },
      };

    case "CUSTOMER_SUPPORT": {
      const isLead = !!opts.isLead;
      const queueOptions: { value: SupportQueue; label: string }[] = isLead
        ? [
            { value: "team", label: "Team Queue" },
            { value: "mine", label: "My Tickets" },
            { value: "unassigned", label: "Unassigned Pool" },
          ]
        : [
            { value: "mine", label: "My Tickets" },
            { value: "team", label: "Team Queue" },
            { value: "unassigned", label: "Unassigned Pool" },
          ];
      return {
        title: isLead ? "Support Settings" : "Agent Settings",
        subtitle: isLead
          ? "Manage your identity, team queue defaults, and support alerts."
          : "Manage your identity, queue defaults, and support alerts.",
        identity: ACCOUNT_COMMON.identityBase("Support hub"),
        queue: {
          heading: "Queue Preferences",
          subtitle: "Defaults applied to your support workspace.",
          queueLabel: "Default queue view",
          queueDesc: "The queue opened when you enter the support workspace.",
          queueOptions,
          autoRefreshLabel: "Auto-refresh queue",
          autoRefreshDesc: "Refresh your ticket queues every 60 seconds.",
          assignmentInfo: {
            label: "Automatic ticket assignment",
            desc: "New support cases are automatically routed based on workload, priority, and support scope. This is managed by the platform.",
          },
        },
        notifications: {
          heading: "Support Notifications",
          subtitle: "Choose which updates appear in your support workspace.",
          items: [
            {
              key: "newAssignment",
              label: "New ticket assignment",
              desc: "When a ticket is assigned to you.",
            },
            {
              key: "highPriorityAssignment",
              label: "High-priority assignment",
              desc: "When a Priority 1 ticket is assigned to you.",
            },
            {
              key: "slaAlerts",
              label: "SLA approaching or breached",
              desc: "When your tickets approach or breach their SLA.",
            },
            {
              key: "customerResponse",
              label: "Customer response",
              desc: "When a customer replies on one of your tickets.",
            },
            {
              key: "reassignment",
              label: "Reassignment & updates",
              desc: "When a ticket is reassigned or updated.",
            },
          ],
        },
      };
    }

    case "PLATFORM_ADMIN":
      return {
        title: "Admin Settings",
        subtitle:
          "Manage your identity, platform administration, notifications, and account security.",
        identity: ACCOUNT_COMMON.identityBase("Administrative scope"),
        admin: {
          heading: "Platform Administration",
          subtitle: "Manage platform configuration from the admin console.",
          links: [
            {
              label: "User & role administration",
              desc: "Assign roles and enable or disable accounts.",
              to: "/admin/users",
            },
            {
              label: "Security Center",
              desc: "Review security controls, events, and threat indicators.",
              to: "/admin/security",
            },
            {
              label: "Store directory",
              desc: "Manage the platform registry of dark stores.",
              to: "/admin/stores",
            },
            {
              label: "Audit logs",
              desc: "Inspect the platform-wide audit trail.",
              to: "/admin/audit-logs",
            },
          ],
        },
        notifications: {
          heading: "Platform Notifications",
          subtitle: "Choose which platform and security alerts you receive.",
          items: [
            {
              key: "securityEvents",
              label: "Security events",
              desc: "Authentication failures and access anomalies.",
            },
            {
              key: "integrationAlerts",
              label: "Integration & system alerts",
              desc: "Upstream integration and system health issues.",
            },
          ],
        },
      };

    default:
      // CUSTOMER has its own dedicated account experience at /customer/profile.
      return {
        title: "Account Settings",
        subtitle: "Manage your account.",
        identity: ACCOUNT_COMMON.identityBase(null),
      };
  }
}
