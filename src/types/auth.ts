export type AppRole =
  | "PLATFORM_ADMIN"
  | "EXECUTIVE"
  | "OPERATIONS"
  | "STORE_MANAGER"
  | "CUSTOMER_SUPPORT"
  | "CUSTOMER";

export type AppPermission =
  // Cases
  | "cases.read.all"
  | "cases.read.assigned"
  | "cases.create"
  | "cases.assign"
  | "cases.escalate"
  | "cases.resolve"
  | "cases.comment"

  // Stores
  | "stores.read.all"
  | "stores.read.own"
  | "stores.manage"

  // Customer Support
  | "support.read"
  | "support.review"
  | "support.decide"

  // Executive
  | "executive.read"

  // Customers
  | "customers.read.own"
  | "customers.create_complaint"

  // Orders
  | "orders.read.all"
  | "orders.read.own"

  // Work Orders
  | "work_orders.read.all"
  | "work_orders.read.own"
  | "work_orders.manage"

  // Fraud
  | "fraud.read"
  | "fraud.decide"

  // Notifications
  | "notifications.read"
  | "notifications.manage"

  // Attachments
  | "attachments.upload"
  | "attachments.read"
  | "attachments.read.own"

  // Audit
  | "audit.read"
  | "audit.write"

  // Admin
  | "admin.users"
  | "admin.security"
  | "admin.system"

  // Security
  | "security.read"
  | "security.write";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  hub_city?: string | null;
  store_id?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
}

export interface AuthContext {
  user: UserProfile;
  permissions: Set<AppPermission>;
}
