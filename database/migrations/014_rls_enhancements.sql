-- RLS Enhancements Migration
-- This adds missing RLS policies for tables that were not fully protected in 012_rls.sql

-- Work Orders
DROP POLICY IF EXISTS "work_orders_manager" ON work_orders;
DROP POLICY IF EXISTS "work_orders_elevated" ON work_orders;
DROP POLICY IF EXISTS "work_orders_manager_update" ON work_orders;
DROP POLICY IF EXISTS "work_orders_manager_insert" ON work_orders;
DROP POLICY IF EXISTS "work_orders_elevated_mutate" ON work_orders;

CREATE POLICY "work_orders_manager" ON work_orders
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "work_orders_elevated" ON work_orders
  FOR SELECT USING (get_role() IN ('OPERATIONS','EXECUTIVE','PLATFORM_ADMIN'));
CREATE POLICY "work_orders_manager_update" ON work_orders
  FOR UPDATE USING (get_role() = 'STORE_MANAGER' AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "work_orders_manager_insert" ON work_orders
  FOR INSERT WITH CHECK (get_role() = 'STORE_MANAGER' AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "work_orders_elevated_mutate" ON work_orders
  FOR ALL USING (get_role() IN ('OPERATIONS','PLATFORM_ADMIN'));

-- Alerts
DROP POLICY IF EXISTS "alerts_elevated" ON alerts;
CREATE POLICY "alerts_elevated" ON alerts
  FOR SELECT USING (get_role() IN ('OPERATIONS','EXECUTIVE','PLATFORM_ADMIN'));

-- Store Metrics Snapshots (same as stores)
DROP POLICY IF EXISTS "store_metrics_manager" ON store_metrics_snapshots;
DROP POLICY IF EXISTS "store_metrics_elevated" ON store_metrics_snapshots;
DROP POLICY IF EXISTS "store_metrics_agent" ON store_metrics_snapshots;

CREATE POLICY "store_metrics_manager" ON store_metrics_snapshots
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "store_metrics_elevated" ON store_metrics_snapshots
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS','OPERATIONS_AGENT','OPERATIONS_MANAGER','CUSTOMER_SUPPORT','PLATFORM_ADMIN'));
CREATE POLICY "store_metrics_agent" ON store_metrics_snapshots
  FOR SELECT USING (get_role() IN ('OPERATIONS','OPERATIONS_AGENT','OPERATIONS_MANAGER'));

-- Pulse Scores (same as stores)
DROP POLICY IF EXISTS "pulse_scores_manager" ON pulse_scores;
DROP POLICY IF EXISTS "pulse_scores_elevated" ON pulse_scores;
DROP POLICY IF EXISTS "pulse_scores_agent" ON pulse_scores;

CREATE POLICY "pulse_scores_manager" ON pulse_scores
  FOR SELECT USING (get_role() = 'STORE_MANAGER' AND store_id = (SELECT store_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "pulse_scores_elevated" ON pulse_scores
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS','OPERATIONS_AGENT','OPERATIONS_MANAGER','CUSTOMER_SUPPORT','PLATFORM_ADMIN'));
CREATE POLICY "pulse_scores_agent" ON pulse_scores
  FOR SELECT USING (get_role() IN ('OPERATIONS','OPERATIONS_AGENT','OPERATIONS_MANAGER'));

-- Complaint Status History (based on complaints) 
DROP POLICY IF EXISTS "complaint_status_history_customer" ON complaint_status_history;
DROP POLICY IF EXISTS "complaint_status_history_agent" ON complaint_status_history;
DROP POLICY IF EXISTS "complaint_status_history_elevated" ON complaint_status_history;

CREATE POLICY "complaint_status_history_customer" ON complaint_status_history
  FOR SELECT USING (
    get_role() = 'CUSTOMER' AND 
    complaint_id IN (SELECT id FROM complaints WHERE customer_id = (SELECT id FROM customers WHERE profile_id = auth.uid()))
  );
CREATE POLICY "complaint_status_history_agent" ON complaint_status_history
  FOR SELECT USING (
    get_role() = 'OPERATIONS' AND 
    complaint_id IN (SELECT id FROM complaints WHERE assigned_agent_id = auth.uid())
  );
CREATE POLICY "complaint_status_history_elevated" ON complaint_status_history
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- Complaint Comments (based on complaints)
DROP POLICY IF EXISTS "complaint_comments_customer" ON complaint_comments;
DROP POLICY IF EXISTS "complaint_comments_agent" ON complaint_comments;
DROP POLICY IF EXISTS "complaint_comments_elevated" ON complaint_comments;
DROP POLICY IF EXISTS "complaint_comments_mutate" ON complaint_comments;

CREATE POLICY "complaint_comments_customer" ON complaint_comments
  FOR SELECT USING (
    get_role() = 'CUSTOMER' AND 
    complaint_id IN (SELECT id FROM complaints WHERE customer_id = (SELECT id FROM customers WHERE profile_id = auth.uid()))
  );
CREATE POLICY "complaint_comments_agent" ON complaint_comments
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
DROP POLICY IF EXISTS "fraud_risk_factors_elevated" ON fraud_risk_factors;
CREATE POLICY "fraud_risk_factors_elevated" ON fraud_risk_factors
  FOR SELECT USING (
    fraud_review_id IN (SELECT id FROM fraud_reviews) AND
    get_role() IN ('CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN')
  );

-- Fraud Review History (based on fraud_reviews)
DROP POLICY IF EXISTS "fraud_review_history_elevated" ON fraud_review_history;
CREATE POLICY "fraud_review_history_elevated" ON fraud_review_history
  FOR SELECT USING (
    fraud_review_id IN (SELECT id FROM fraud_reviews) AND
    get_role() IN ('CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN')
  );

-- Audit Logs (append-only, admin only)
-- Disable RLS on audit_logs since they are controlled at API level with service role
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
