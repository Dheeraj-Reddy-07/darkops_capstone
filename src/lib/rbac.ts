import { AppRole, AppPermission } from "@/types/auth";

export const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  PLATFORM_ADMIN: [
    "cases.read.all",
    "cases.read.assigned",
    "cases.create",
    "cases.assign",
    "cases.escalate",
    "cases.resolve",
    "cases.comment",
    "stores.read.all",
    "stores.read.own",
    "stores.manage",
    "support.read",
    "support.review",
    "support.decide",
    "executive.read",
    "customers.read.own",
    "customers.create_complaint",
    "orders.read.all",
    "orders.read.own",
    "work_orders.read.all",
    "work_orders.read.own",
    "work_orders.manage",
    "fraud.read",
    "fraud.decide",
    "notifications.read",
    "notifications.manage",
    "attachments.upload",
    "attachments.read",
    "audit.read",
    "audit.write",
    "admin.users",
    "admin.security",
    "admin.system",
  ],
  EXECUTIVE: [
    "executive.read",
    "cases.read.all",
    "stores.read.all",
    "support.read",
    "orders.read.all",
    "work_orders.read.all",
    "fraud.read",
    "notifications.read",
  ],
  OPERATIONS: [
    "cases.read.all",
    "cases.read.assigned",
    "cases.assign",
    "cases.escalate",
    "cases.resolve",
    "cases.comment",
    "stores.read.all",
    "support.read",
    "orders.read.all",
    "work_orders.read.all",
    "work_orders.manage",
    "notifications.read",
    "attachments.upload",
    "attachments.read",
  ],
  CUSTOMER_SUPPORT: [
    "support.read",
    "support.review",
    "support.decide",
    "cases.comment",
    "cases.read.all",
    "orders.read.all",
    "customers.read.own",
    "notifications.read",
    "attachments.read",
    // Fraud review is a support capability (matches server RBAC); enables the
    // "Open risk review" links from case/ticket detail to reach /fraud/:id.
    "fraud.read",
    "fraud.decide",
  ],
  STORE_MANAGER: [
    "stores.read.own",
    "work_orders.read.own",
    "work_orders.manage",
    "notifications.read",
    "attachments.upload",
    "attachments.read.own",
  ],
  CUSTOMER: [
    "customers.read.own",
    "customers.create_complaint",
    "orders.read.own",
    "notifications.read",
    "attachments.upload",
    "attachments.read.own",
  ],
};

export const ROUTE_PERMISSIONS: Record<string, AppPermission[]> = {
  "/executive": ["executive.read"],
  "/operations": ["cases.read.all", "cases.read.assigned"],
  "/cases/": ["cases.read.all", "cases.read.assigned"],
  "/fraud": ["fraud.read"],
  "/fraud/": ["fraud.read"],
  "/support": ["support.read"],
  "/dark-stores": ["stores.read.all", "stores.read.own"],
  "/dark-stores/": ["stores.read.all", "stores.read.own"],
  "/admin": ["admin.users"],
  "/admin/": ["admin.users"],
  "/customer": ["customers.read.own"],
  "/customer/": ["customers.read.own"],
  "/report-issue": ["customers.read.own"],
};

export function hasPermission(role: AppRole, permission: AppPermission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

export function hasAnyPermission(role: AppRole, permissions: AppPermission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

export function hasAllPermissions(role: AppRole, permissions: AppPermission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

export function canAccessRoute(role: AppRole, path: string): boolean {
  // Check exact match first
  if (ROUTE_PERMISSIONS[path]) {
    return ROUTE_PERMISSIONS[path].some((perm) => hasPermission(role, perm));
  }

  // Check prefix matches (handles dynamic routes like /customer/orders/ORD-001)
  const matchingPrefix = Object.keys(ROUTE_PERMISSIONS).find(
    (prefix) => prefix.endsWith("/") && path.startsWith(prefix),
  );
  if (matchingPrefix) {
    return (ROUTE_PERMISSIONS[matchingPrefix] ?? []).some((perm) => hasPermission(role, perm));
  }

  // Check route groups (e.g., /admin/users matches /admin/)
  const rootMatch = Object.keys(ROUTE_PERMISSIONS).find(
    (prefix) => !prefix.endsWith("/") && prefix !== path && path.startsWith(prefix + "/"),
  );
  if (rootMatch) {
    return (ROUTE_PERMISSIONS[rootMatch] ?? []).some((perm) => hasPermission(role, perm));
  }

  return true; // No specific permissions required for this path
}
