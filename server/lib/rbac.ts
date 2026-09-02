import { AppRole, AppPermission } from "../../src/types/auth";

export const ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  PLATFORM_ADMIN: [
    'cases.read.all', 'cases.read.assigned', 'cases.create', 'cases.assign', 'cases.escalate', 'cases.resolve', 'cases.comment',
    'stores.read.all', 'stores.read.own', 'stores.manage',
    'fraud.read', 'fraud.review', 'fraud.decide',
    'executive.read',
    'customers.read.own', 'customers.create_complaint',
    'orders.read.all', 'orders.read.own',
    'work_orders.read.all', 'work_orders.read.own', 'work_orders.manage',
    'audit.read', 'admin.users'
  ],
  EXECUTIVE: [
    'executive.read',
    'cases.read.all',
    'stores.read.all',
    'fraud.read',
    'orders.read.all',
    'work_orders.read.all'
  ],
  OPERATIONS: [
    'cases.read.all', 'cases.read.assigned', 'cases.assign', 'cases.escalate', 'cases.resolve', 'cases.comment',
    'stores.read.all',
    'fraud.read',
    'orders.read.all',
    'work_orders.read.all', 'work_orders.manage'
  ],
  FRAUD_ANALYST: [
    'fraud.read', 'fraud.review', 'fraud.decide',
    'cases.comment',
    'orders.read.all'
  ],
  STORE_MANAGER: [
    'stores.read.own',
    'work_orders.read.own', 'work_orders.manage'
  ],
  CUSTOMER: [
    'customers.read.own', 'customers.create_complaint',
    'orders.read.own'
  ]
};

export function getPermissionsForRole(role: AppRole): Set<AppPermission> {
  return new Set(ROLE_PERMISSIONS[role] || []);
}
