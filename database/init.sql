-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Create ENUMs for the application

-- Roles
CREATE TYPE app_role AS ENUM (
  'ADMIN',
  'EXECUTIVE',
  'OPERATIONS_MANAGER',
  'OPERATIONS_AGENT',
  'CUSTOMER_SUPPORT',
  'FRAUD_ANALYST',
  'STORE_MANAGER',
  'CUSTOMER',
  'DELIVERY_PARTNER'
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
-- Create profiles table
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          app_role NOT NULL DEFAULT 'OPERATIONS_AGENT',
  hub_city      TEXT,           -- For agents: their assigned hub city
  store_id      TEXT,           -- For STORE_MANAGER: their store
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Create stores table
CREATE TABLE stores (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  city                  TEXT NOT NULL,
  zone                  TEXT NOT NULL,
  manager_name          TEXT NOT NULL,
  manager_profile_id    UUID REFERENCES profiles(id),
  pickers_on_shift      INT NOT NULL DEFAULT 12,
  riders_assigned       INT NOT NULL DEFAULT 8,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store metrics snapshots
CREATE TABLE store_metrics_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              TEXT NOT NULL REFERENCES stores(id),
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_pct               NUMERIC(5,2) NOT NULL,
  refund_rate_pct       NUMERIC(5,2) NOT NULL,
  avg_resolution_mins   INT NOT NULL,
  open_issues           INT NOT NULL DEFAULT 0,
  equipment_failures_14d INT NOT NULL DEFAULT 0,
  inventory_issues      INT NOT NULL DEFAULT 0,
  delivery_delays       INT NOT NULL DEFAULT 0,
  picker_delay_mins     NUMERIC(4,1) NOT NULL DEFAULT 2.5
);
-- Customers table
CREATE TABLE customers (
  id                TEXT PRIMARY KEY,
  profile_id        UUID UNIQUE REFERENCES profiles(id),
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE,
  phone             TEXT,
  city              TEXT,
  address           TEXT,
  prior_claims_90d  INT NOT NULL DEFAULT 0,
  upheld_claims_90d INT NOT NULL DEFAULT 0,
  account_standing  TEXT NOT NULL DEFAULT 'good' CHECK (account_standing IN ('good','restricted','banned')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id                TEXT PRIMARY KEY,
  customer_id       TEXT NOT NULL REFERENCES customers(id),
  store_id          TEXT NOT NULL REFERENCES stores(id),
  placed_at         TIMESTAMPTZ NOT NULL,
  status            order_status NOT NULL DEFAULT 'packing',
  total_amount_paise BIGINT NOT NULL,
  item_count        INT NOT NULL DEFAULT 0,
  items_preview     TEXT,
  delivery_partner  TEXT,
  delivery_partner_id TEXT,
  eta_at            TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    TEXT NOT NULL REFERENCES orders(id),
  name        TEXT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  unit_price_paise BIGINT NOT NULL
);

-- Delivery partners table
CREATE TABLE delivery_partners (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  store_id    TEXT REFERENCES stores(id),
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Complaints table
CREATE TABLE complaints (
  id                  TEXT PRIMARY KEY,
  complaint_ref       TEXT NOT NULL UNIQUE,
  customer_id         TEXT NOT NULL REFERENCES customers(id),
  order_id            TEXT NOT NULL REFERENCES orders(id),
  store_id            TEXT NOT NULL REFERENCES stores(id),
  summary             TEXT NOT NULL,
  detail              TEXT NOT NULL,
  category            complaint_category NOT NULL,
  type                complaint_type NOT NULL,
  priority            priority_level NOT NULL DEFAULT 'P3',
  status              complaint_status NOT NULL DEFAULT 'unassigned',
  sla_state           sla_state NOT NULL DEFAULT 'on_track',
  sla_due_at          TIMESTAMPTZ,
  assigned_agent_id   UUID REFERENCES profiles(id),
  order_value_paise   BIGINT NOT NULL DEFAULT 0,
  refund_amount_paise BIGINT NOT NULL DEFAULT 0,
  urgency             TEXT,
  sentiment           TEXT,
  qc_score            INT CHECK (qc_score BETWEEN 0 AND 100),
  classifier_confidence INT CHECK (classifier_confidence BETWEEN 0 AND 100),
  resolution          TEXT,
  resolved_note       TEXT,
  resolved_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable status history
CREATE TABLE complaint_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    TEXT NOT NULL REFERENCES complaints(id),
  from_status     complaint_status,
  to_status       complaint_status NOT NULL,
  changed_by      UUID REFERENCES profiles(id),
  note            TEXT,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
CREATE TABLE complaint_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    TEXT NOT NULL REFERENCES complaints(id),
  author_id       UUID NOT NULL REFERENCES profiles(id),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Work orders table
CREATE TABLE work_orders (
  id              TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL REFERENCES stores(id),
  asset_id        TEXT NOT NULL,
  asset_name      TEXT NOT NULL,
  priority        priority_level NOT NULL,
  status          work_order_status NOT NULL DEFAULT 'open',
  sla_due_at      TIMESTAMPTZ,
  assigned_to     UUID REFERENCES profiles(id),
  description     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equipment assets
CREATE TABLE equipment_assets (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'operational'
              CHECK (status IN ('operational','degraded','failed','under_maintenance')),
  last_service_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Network alerts
CREATE TABLE alerts (
  id              TEXT PRIMARY KEY,
  store_id        TEXT REFERENCES stores(id),
  title           TEXT NOT NULL,
  detail          TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('crit','warn','info')),
  is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Fraud reviews table
CREATE TABLE fraud_reviews (
  id                    TEXT PRIMARY KEY,
  complaint_id          TEXT NOT NULL REFERENCES complaints(id),
  customer_id           TEXT NOT NULL REFERENCES customers(id),
  risk_confidence       INT NOT NULL CHECK (risk_confidence BETWEEN 0 AND 100),
  reason                TEXT NOT NULL,
  decision              fraud_decision NOT NULL DEFAULT 'pending_review',
  decided_by            UUID REFERENCES profiles(id),
  decision_note         TEXT,
  decided_at            TIMESTAMPTZ,
  ai_model              TEXT,
  ai_model_version      TEXT,
  flagged_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fraud risk factors
CREATE TABLE fraud_risk_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_review_id TEXT NOT NULL REFERENCES fraud_reviews(id),
  label           TEXT NOT NULL,
  weight          INT NOT NULL,
  evidence        TEXT NOT NULL
);

-- Fraud review history
CREATE TABLE fraud_review_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_review_id TEXT NOT NULL REFERENCES fraud_reviews(id),
  actor_id        UUID REFERENCES profiles(id),
  actor_label     TEXT NOT NULL,
  action          TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refund requests
CREATE TABLE refund_requests (
  id              TEXT PRIMARY KEY,
  complaint_id    TEXT NOT NULL REFERENCES complaints(id),
  customer_id     TEXT NOT NULL REFERENCES customers(id),
  amount_paise    BIGINT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested','under_review','approved','denied','processed')),
  processed_by    UUID REFERENCES profiles(id),
  processed_at    TIMESTAMPTZ,
  denial_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Pulse scores table
CREATE TABLE pulse_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          TEXT NOT NULL REFERENCES stores(id) UNIQUE,
  score             INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  equipment_pts     INT NOT NULL DEFAULT 0 CHECK (equipment_pts BETWEEN 0 AND 25),
  sla_pts           INT NOT NULL DEFAULT 0 CHECK (sla_pts BETWEEN 0 AND 25),
  refunds_pts       INT NOT NULL DEFAULT 0 CHECK (refunds_pts BETWEEN 0 AND 20),
  delivery_pts      INT NOT NULL DEFAULT 0 CHECK (delivery_pts BETWEEN 0 AND 15),
  picker_pts        INT NOT NULL DEFAULT 0 CHECK (picker_pts BETWEEN 0 AND 10),
  inventory_pts     INT NOT NULL DEFAULT 0 CHECK (inventory_pts BETWEEN 0 AND 10),
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_score CHECK (
    score = GREATEST(12, 100 - (equipment_pts + sla_pts + refunds_pts + delivery_pts + picker_pts + inventory_pts))
  )
);
-- Notifications table
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID NOT NULL REFERENCES profiles(id),
  title           TEXT NOT NULL,
  meta            TEXT,
  link_type       TEXT,
  link_ref        TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Audit logs table
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES profiles(id),
  actor_role      TEXT NOT NULL,
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  ip_address      INET,
  correlation_id  TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chatbot sessions
CREATE TABLE insight_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  messages    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_sessions ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION get_role()
RETURNS app_role
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_customer_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id FROM public.customers WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_profile_store_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$;

-- RLS Policies

-- Profiles
CREATE POLICY "profiles_own" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_admin" ON profiles
  FOR SELECT USING (get_role() = 'ADMIN');

-- Stores
CREATE POLICY "stores_manager" ON stores
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND id = get_profile_store_id());
CREATE POLICY "stores_elevated" ON stores
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS_MANAGER','FRAUD_ANALYST','ADMIN'));
CREATE POLICY "stores_agent" ON stores
  FOR SELECT USING (get_role() = 'OPERATIONS_AGENT');

-- Customers
CREATE POLICY "customers_own" ON customers
  FOR SELECT USING (get_role() = 'CUSTOMER' AND profile_id = auth.uid());
CREATE POLICY "customers_elevated" ON customers
  FOR SELECT USING (get_role() IN ('OPERATIONS_AGENT', 'OPERATIONS_MANAGER','FRAUD_ANALYST','EXECUTIVE','ADMIN'));

-- Orders
CREATE POLICY "orders_customer" ON orders
  FOR SELECT USING (get_role() = 'CUSTOMER' AND customer_id = get_customer_id());
CREATE POLICY "orders_elevated" ON orders
  FOR SELECT USING (get_role() IN ('OPERATIONS_AGENT', 'OPERATIONS_MANAGER','FRAUD_ANALYST','EXECUTIVE','ADMIN'));

-- Complaints
CREATE POLICY "complaints_customer" ON complaints
  FOR SELECT USING (get_role() = 'CUSTOMER' AND customer_id = get_customer_id());
CREATE POLICY "complaints_agent" ON complaints
  FOR SELECT USING (get_role() = 'OPERATIONS_AGENT' AND assigned_agent_id = auth.uid());
CREATE POLICY "complaints_agent_unassigned" ON complaints
  FOR SELECT USING (get_role() = 'OPERATIONS_AGENT' AND assigned_agent_id IS NULL);
CREATE POLICY "complaints_elevated" ON complaints
  FOR SELECT USING (get_role() IN ('OPERATIONS_MANAGER','FRAUD_ANALYST','EXECUTIVE','ADMIN'));

-- Fraud Reviews
CREATE POLICY "fraud_elevated" ON fraud_reviews
  FOR SELECT USING (get_role() IN ('FRAUD_ANALYST','OPERATIONS_MANAGER','ADMIN'));

-- Notifications
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (recipient_id = auth.uid());

-- Order Items
CREATE POLICY "order_items_customer" ON order_items
  FOR SELECT USING (get_role() = 'CUSTOMER' AND order_id IN (SELECT id FROM orders WHERE customer_id = get_customer_id()));
CREATE POLICY "order_items_elevated" ON order_items
  FOR SELECT USING (get_role() IN ('OPERATIONS_AGENT', 'OPERATIONS_MANAGER','FRAUD_ANALYST','EXECUTIVE','ADMIN'));

-- Delivery Partners
CREATE POLICY "delivery_partners_elevated" ON delivery_partners
  FOR SELECT USING (get_role() IN ('OPERATIONS_MANAGER','EXECUTIVE','ADMIN'));

-- Refund Requests
CREATE POLICY "refund_requests_customer" ON refund_requests
  FOR SELECT USING (get_role() = 'CUSTOMER' AND customer_id = get_customer_id());
CREATE POLICY "refund_requests_elevated" ON refund_requests
  FOR SELECT USING (get_role() IN ('FRAUD_ANALYST', 'OPERATIONS_MANAGER', 'EXECUTIVE', 'ADMIN', 'CUSTOMER_SUPPORT'));

-- Equipment Assets
CREATE POLICY "equipment_assets_store_manager" ON equipment_assets
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "equipment_assets_elevated" ON equipment_assets
  FOR SELECT USING (get_role() IN ('OPERATIONS_MANAGER', 'EXECUTIVE', 'ADMIN'));

-- Insight Sessions
CREATE POLICY "insight_sessions_own" ON insight_sessions
  FOR ALL USING (user_id = auth.uid());

-- Store Metrics Snapshots
CREATE POLICY "store_metrics_manager" ON store_metrics_snapshots
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "store_metrics_elevated" ON store_metrics_snapshots
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS_MANAGER','ADMIN'));

-- Work Orders
CREATE POLICY "work_orders_manager" ON work_orders
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "work_orders_elevated" ON work_orders
  FOR SELECT USING (get_role() IN ('OPERATIONS_MANAGER','EXECUTIVE','ADMIN'));

-- Alerts
CREATE POLICY "alerts_elevated" ON alerts
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS_MANAGER','ADMIN'));

-- Pulse Scores
CREATE POLICY "pulse_scores_manager" ON pulse_scores
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "pulse_scores_elevated" ON pulse_scores
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS_MANAGER','ADMIN'));

-- Audit Logs
CREATE POLICY "audit_logs_admin" ON audit_logs
  FOR SELECT USING (get_role() = 'ADMIN');

-- Note: Other policies will be strictly enforced server-side.
-- Note: Service Role bypasses RLS, so mutations will mostly be done via server routes using Service Role + RBAC.
-- Create indexes for performance

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_stores_city ON stores(city);
CREATE INDEX idx_stores_zone ON stores(zone);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_complaints_customer_id ON complaints(customer_id);
CREATE INDEX idx_complaints_order_id ON complaints(order_id);
CREATE INDEX idx_complaints_store_id ON complaints(store_id);
CREATE INDEX idx_complaints_assigned_agent ON complaints(assigned_agent_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_fraud_reviews_complaint_id ON fraud_reviews(complaint_id);
CREATE INDEX idx_fraud_reviews_decision ON fraud_reviews(decision);
CREATE INDEX idx_pulse_scores_store_id ON pulse_scores(store_id);
CREATE INDEX idx_work_orders_store_id ON work_orders(store_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_equipment_store_id ON equipment_assets(store_id);
CREATE INDEX idx_refunds_complaint_id ON refund_requests(complaint_id);

-- RPC for atomic complaint creation
CREATE OR REPLACE FUNCTION create_complaint(
  p_id TEXT,
  p_ref TEXT,
  p_customer_id TEXT,
  p_order_id TEXT,
  p_store_id TEXT,
  p_summary TEXT,
  p_detail TEXT,
  p_category complaint_category,
  p_type complaint_type,
  p_priority priority_level,
  p_sla_due_at TIMESTAMPTZ
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert the complaint
  INSERT INTO complaints (id, complaint_ref, customer_id, order_id, store_id, summary, detail, category, type, priority, sla_due_at, status)
  VALUES (p_id, p_ref, p_customer_id, p_order_id, p_store_id, p_summary, p_detail, p_category, p_type, p_priority, p_sla_due_at, 'unassigned');
  
  -- Insert status history
  INSERT INTO complaint_status_history (complaint_id, to_status, note)
  VALUES (p_id, 'unassigned', 'Complaint created by customer');
  
  -- Notification for customer
  INSERT INTO notifications (recipient_id, title, meta)
  SELECT profile_id, 'Complaint Received', '{"complaint_id":"' || p_id || '"}'
  FROM customers WHERE id = p_customer_id;
END;
$$;

-- RPC for atomic fraud decision
CREATE OR REPLACE FUNCTION process_fraud_decision(
  p_fraud_id TEXT,
  p_decision fraud_decision,
  p_actor_id UUID,
  p_actor_label TEXT,
  p_note TEXT,
  p_complaint_id TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update fraud review
  UPDATE fraud_reviews 
  SET decision = p_decision, decided_by = p_actor_id, decision_note = p_note, decided_at = NOW()
  WHERE id = p_fraud_id;
  
  -- Insert history
  INSERT INTO fraud_review_history (fraud_review_id, actor_id, actor_label, action)
  VALUES (p_fraud_id, p_actor_id, p_actor_label, 'Decision: ' || p_decision::text);
  
  -- Update related refund request
  UPDATE refund_requests
  SET status = CASE 
      WHEN p_decision = 'approved' THEN 'approved'
      WHEN p_decision = 'denied' THEN 'denied'
      ELSE status 
    END,
    processed_by = p_actor_id,
    processed_at = NOW(),
    denial_reason = CASE WHEN p_decision = 'denied' THEN p_note ELSE NULL END
  WHERE complaint_id = p_complaint_id;
  
  -- Insert audit log
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, metadata)
  VALUES (p_actor_id, 'FRAUD_ANALYST', 'fraud_decision', 'fraud_review', p_fraud_id, jsonb_build_object('decision', p_decision));
END;
$$;
