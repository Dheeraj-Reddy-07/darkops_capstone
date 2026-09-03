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
  FOR SELECT USING (get_role() = 'PLATFORM_ADMIN');

-- Stores
CREATE POLICY "stores_manager" ON stores
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND id = get_profile_store_id());
CREATE POLICY "stores_elevated" ON stores
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS','CUSTOMER_SUPPORT','PLATFORM_ADMIN'));
CREATE POLICY "stores_operations" ON stores
  FOR SELECT USING (get_role() = 'OPERATIONS');

-- Customers
CREATE POLICY "customers_own" ON customers
  FOR SELECT USING (get_role() = 'CUSTOMER' AND profile_id = auth.uid());
CREATE POLICY "customers_elevated" ON customers
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- Orders
CREATE POLICY "orders_customer" ON orders
  FOR SELECT USING (get_role() = 'CUSTOMER' AND customer_id = get_customer_id());
CREATE POLICY "orders_elevated" ON orders
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- Complaints
CREATE POLICY "complaints_customer" ON complaints
  FOR SELECT USING (get_role() = 'CUSTOMER' AND customer_id = get_customer_id());
CREATE POLICY "complaints_operations" ON complaints
  FOR SELECT USING (get_role() = 'OPERATIONS' AND assigned_agent_id = auth.uid());
CREATE POLICY "complaints_operations_unassigned" ON complaints
  FOR SELECT USING (get_role() = 'OPERATIONS' AND assigned_agent_id IS NULL);
CREATE POLICY "complaints_elevated" ON complaints
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- Fraud Reviews
CREATE POLICY "fraud_elevated" ON fraud_reviews
  FOR SELECT USING (get_role() IN ('CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN'));

-- Work Orders
CREATE POLICY "work_orders_manager" ON work_orders
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "work_orders_elevated" ON work_orders
  FOR SELECT USING (get_role() IN ('OPERATIONS','EXECUTIVE','PLATFORM_ADMIN'));
CREATE POLICY "work_orders_manager_update" ON work_orders
  FOR UPDATE USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "work_orders_manager_insert" ON work_orders
  FOR INSERT WITH CHECK (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "work_orders_elevated_mutate" ON work_orders
  FOR ALL USING (get_role() IN ('OPERATIONS','PLATFORM_ADMIN'));

-- Alerts
CREATE POLICY "alerts_elevated" ON alerts
  FOR SELECT USING (get_role() IN ('OPERATIONS','EXECUTIVE','PLATFORM_ADMIN'));

-- Store Metrics Snapshots (same as stores)
CREATE POLICY "store_metrics_manager" ON store_metrics_snapshots
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "store_metrics_elevated" ON store_metrics_snapshots
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS','CUSTOMER_SUPPORT','PLATFORM_ADMIN'));
CREATE POLICY "store_metrics_operations" ON store_metrics_snapshots
  FOR SELECT USING (get_role() = 'OPERATIONS');

-- Pulse Scores (same as stores)
CREATE POLICY "pulse_scores_manager" ON pulse_scores
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = get_profile_store_id());
CREATE POLICY "pulse_scores_elevated" ON pulse_scores
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS','CUSTOMER_SUPPORT','PLATFORM_ADMIN'));
CREATE POLICY "pulse_scores_operations" ON pulse_scores
  FOR SELECT USING (get_role() = 'OPERATIONS');

-- Complaint Status History (based on complaints)
CREATE POLICY "complaint_status_history_customer" ON complaint_status_history
  FOR SELECT USING (
    get_role() = 'CUSTOMER' AND 
    complaint_id IN (SELECT id FROM complaints WHERE customer_id = get_customer_id())
  );
CREATE POLICY "complaint_status_history_operations" ON complaint_status_history
  FOR SELECT USING (
    get_role() = 'OPERATIONS' AND 
    complaint_id IN (SELECT id FROM complaints WHERE assigned_agent_id = auth.uid())
  );
CREATE POLICY "complaint_status_history_elevated" ON complaint_status_history
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- Complaint Comments (based on complaints)
CREATE POLICY "complaint_comments_customer" ON complaint_comments
  FOR SELECT USING (
    get_role() = 'CUSTOMER' AND 
    complaint_id IN (SELECT id FROM complaints WHERE customer_id = get_customer_id())
  );
CREATE POLICY "complaint_comments_operations" ON complaint_comments
  FOR SELECT USING (
    get_role() = 'OPERATIONS' AND 
    complaint_id IN (SELECT id FROM complaints WHERE assigned_agent_id = auth.uid())
  );
CREATE POLICY "complaint_comments_elevated" ON complaint_comments
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));
CREATE POLICY "complaint_comments_mutate" ON complaint_comments
  FOR INSERT WITH CHECK (
    (get_role() = 'OPERATIONS' AND complaint_id IN (SELECT id FROM complaints WHERE assigned_agent_id = auth.uid())) OR
    (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','PLATFORM_ADMIN'))
  );

-- Fraud Risk Factors (based on fraud_reviews)
CREATE POLICY "fraud_risk_factors_elevated" ON fraud_risk_factors
  FOR SELECT USING (
    fraud_review_id IN (SELECT id FROM fraud_reviews) AND
    get_role() IN ('CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN')
  );

-- Fraud Review History (based on fraud_reviews)
CREATE POLICY "fraud_review_history_elevated" ON fraud_review_history
  FOR SELECT USING (
    fraud_review_id IN (SELECT id FROM fraud_reviews) AND
    get_role() IN ('CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN')
  );

-- Notifications
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (recipient_id = auth.uid());

-- Audit Logs (append-only, admin only)
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
-- Audit logs are controlled at the API level using service role + RBAC

-- Note: Service Role bypasses RLS, so mutations will mostly be done via server routes using Service Role + RBAC.
