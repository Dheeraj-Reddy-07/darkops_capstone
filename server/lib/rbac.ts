import { AppRole, AppPermission } from "../../src/types/auth";

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
    "security.read",
    "security.write",
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

const ROLE_ALIASES: Record<string, AppRole> = {
  FRAUD: "CUSTOMER_SUPPORT",
  OPERATIONS_AGENT: "OPERATIONS",
  ADMIN: "PLATFORM_ADMIN",
};

export function getPermissionsForRole(role: AppRole | string): Set<AppPermission> {
  const normalizedRole = ROLE_ALIASES[role] || (role as AppRole);
  return new Set(ROLE_PERMISSIONS[normalizedRole] || []);
}

export function hasPermission(role: AppRole | string, permission: AppPermission): boolean {
  const normalizedRole = ROLE_ALIASES[role] || (role as AppRole);
  return ROLE_PERMISSIONS[normalizedRole]?.includes(permission) || false;
}

export function hasAnyPermission(role: AppRole | string, permissions: AppPermission[]): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

export function hasAllPermissions(role: AppRole | string, permissions: AppPermission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}
