export type AppRole =
  | 'PLATFORM_ADMIN'
  | 'EXECUTIVE'
  | 'OPERATIONS'
  | 'OPERATIONS_AGENT'
  | 'OPERATIONS_MANAGER'
  | 'FRAUD_ANALYST'
  | 'STORE_MANAGER'
  | 'CUSTOMER';

export type AppPermission =
  // Cases
  | 'cases.read.all'
  | 'cases.read.assigned'
  | 'cases.create'
  | 'cases.assign'
  | 'cases.escalate'
  | 'cases.resolve'
  | 'cases.comment'
  
  // Stores
  | 'stores.read.all'
  | 'stores.read.own'
  | 'stores.manage'
  
  // Fraud
  | 'fraud.read'
  | 'fraud.review'
  | 'fraud.decide'
  
  // Executive
  | 'executive.read'
  
  // Customers
  | 'customers.read.own'
  | 'customers.create_complaint'
  
  // Orders
  | 'orders.read.all'
  | 'orders.read.own'
  
  // Work Orders
  | 'work_orders.read.all'
  | 'work_orders.read.own'
  | 'work_orders.manage'
  
  // Audit
  | 'audit.read'
  | 'admin.users';

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
