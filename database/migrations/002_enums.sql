-- Create ENUMs for the application

-- Roles
CREATE TYPE app_role AS ENUM (
  'PLATFORM_ADMIN',
  'EXECUTIVE',
  'OPERATIONS',
  'STORE_MANAGER',
  'FRAUD_ANALYST',
  'CUSTOMER'
);

-- Orders
CREATE TYPE order_status AS ENUM (
  'packing',
  'packed',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refund_in_progress'
);

-- Complaints / Cases
CREATE TYPE complaint_category AS ENUM (
  'late_delivery',
  'quality_issue',
  'missing_item',
  'wrong_item',
  'damaged_item',
  'payment_issue',
  'other'
);

CREATE TYPE complaint_type AS ENUM (
  'refund',
  'reorder',
  'operational_investigation'
);

CREATE TYPE priority_level AS ENUM (
  'P1',
  'P2',
  'P3',
  'P4'
);

CREATE TYPE complaint_status AS ENUM (
  'unassigned',
  'assigned',
  'in_progress',
  'awaiting_customer',
  'escalated_l2',
  'resolved'
);

CREATE TYPE sla_state AS ENUM (
  'on_track',
  'at_risk',
  'breached'
);

-- Operations
CREATE TYPE work_order_status AS ENUM (
  'open',
  'assigned',
  'in_progress',
  'awaiting_parts',
  'resolved',
  'cancelled'
);

-- Fraud
CREATE TYPE fraud_decision AS ENUM (
  'pending_review',
  'approved',
  'denied',
  'escalated'
);
