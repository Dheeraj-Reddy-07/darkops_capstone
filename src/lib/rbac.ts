import { AppRole } from "@/types/auth";

export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  ADMIN: [
    'executive.read',
    'cases.read.all', 'cases.read.assigned', 'cases.create', 'cases.assign', 'cases.escalate', 'cases.resolve',
    'stores.read.all', 'stores.manage',
    'fraud.read', 'fraud.decide',
    'customers.read.own', 'customers.create_complaint',
    'orders.read.all',
    'work_orders.read.all', 'work_orders.manage',
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
    'cases.read.all', 'cases.read.assigned', 'cases.assign', 'cases.escalate', 'cases.resolve',
    'stores.read.all',
    'fraud.read',
    'orders.read.all',
    'work_orders.read.all', 'work_orders.manage'
  ],
  OPERATIONS_MANAGER: [
    'cases.read.all', 'cases.read.assigned', 'cases.assign', 'cases.escalate', 'cases.resolve',
    'stores.read.all',
    'fraud.read',
    'orders.read.all',
    'work_orders.read.all', 'work_orders.manage'
  ],
  OPERATIONS_AGENT: [
    'cases.read.assigned', 'cases.escalate', 'cases.resolve',
    'orders.read.all'
  ],
  FRAUD_ANALYST: [
    'fraud.read', 'fraud.decide',
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

export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/executive': ['executive.read'],
  '/executive/insights': ['executive.read'],
  '/operations': ['cases.read.all', 'cases.read.assigned'],
  '/cases': ['cases.read.all', 'cases.read.assigned'],
  '/fraud': ['fraud.read'],
  '/dark-stores': ['stores.read.all', 'stores.read.own'],
  '/admin': ['admin.users'],
  '/customer': ['customers.read.own'],
  '/customer/support': ['customers.create_complaint'],
};

export function hasPermission(role: AppRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

export function canAccessRoute(role: AppRole, path: string): boolean {
  const requiredPermissions = ROUTE_PERMISSIONS[path];
  if (!requiredPermissions) return true; // No specific permissions required
  return requiredPermissions.some(perm => hasPermission(role, perm));
}
