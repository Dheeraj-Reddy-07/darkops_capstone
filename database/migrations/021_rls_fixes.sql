-- Migration 021: RLS Fixes and Role Alignment
-- This migration fixes RLS policies to match the actual role enum and adds missing policies

-- Current role enum (from 002_enums.sql):
-- PLATFORM_ADMIN, EXECUTIVE, OPERATIONS, STORE_MANAGER, CUSTOMER_SUPPORT, CUSTOMER

-- 1. Fix RLS policies that reference non-existent roles
-- Fix store_metrics_snapshots to remove OPERATIONS_AGENT and OPERATIONS_MANAGER references
DROP POLICY IF EXISTS "store_metrics_elevated" ON store_metrics_snapshots;
CREATE POLICY "store_metrics_elevated" ON store_metrics_snapshots
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS','CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

DROP POLICY IF EXISTS "store_metrics_agent" ON store_metrics_snapshots;
CREATE POLICY "store_metrics_agent" ON store_metrics_snapshots
  FOR SELECT USING (get_role() = 'OPERATIONS');

-- Fix pulse_scores to remove OPERATIONS_AGENT and OPERATIONS_MANAGER references
DROP POLICY IF EXISTS "pulse_scores_elevated" ON pulse_scores;
CREATE POLICY "pulse_scores_elevated" ON pulse_scores
  FOR SELECT USING (get_role() IN ('EXECUTIVE','OPERATIONS','CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

DROP POLICY IF EXISTS "pulse_scores_agent" ON pulse_scores;
CREATE POLICY "pulse_scores_agent" ON pulse_scores
  FOR SELECT USING (get_role() = 'OPERATIONS');

-- 2. Add missing RLS policies for tables that need them
-- failed_automation needs INSERT/UPDATE policies
DROP POLICY IF EXISTS "failed_automation_support" ON failed_automation;
CREATE POLICY "failed_automation_support" ON failed_automation
  FOR SELECT USING (get_role() = 'CUSTOMER_SUPPORT');

CREATE POLICY "failed_automation_support_insert" ON failed_automation
  FOR INSERT WITH CHECK (get_role() = 'PLATFORM_ADMIN');

CREATE POLICY "failed_automation_support_update" ON failed_automation
  FOR UPDATE USING (get_role() = 'PLATFORM_ADMIN');

-- support_tickets needs INSERT/UPDATE policies
DROP POLICY IF EXISTS "support_tickets_own" ON support_tickets;
CREATE POLICY "support_tickets_own" ON support_tickets
  FOR SELECT USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "support_tickets_support" ON support_tickets;
CREATE POLICY "support_tickets_support" ON support_tickets
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

CREATE POLICY "support_tickets_operations_read" ON support_tickets
  FOR SELECT USING (get_role() = 'OPERATIONS');

CREATE POLICY "support_tickets_operations_insert" ON support_tickets
  FOR INSERT WITH CHECK (get_role() IN ('CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

CREATE POLICY "support_tickets_operations_update" ON support_tickets
  FOR UPDATE USING (get_role() IN ('CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

-- support_ticket_history needs INSERT policy
DROP POLICY IF EXISTS "ticket_history_support" ON support_ticket_history;
CREATE POLICY "ticket_history_support" ON support_ticket_history
  FOR SELECT USING (get_role() IN ('CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

CREATE POLICY "ticket_history_support_insert" ON support_ticket_history
  FOR INSERT WITH CHECK (get_role() IN ('CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

-- ticket_activity needs INSERT policy
DROP POLICY IF EXISTS "ticket_activity_support" ON ticket_activity;
CREATE POLICY "ticket_activity_support" ON ticket_activity
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

-- ticket_attachments needs INSERT/UPDATE policies
DROP POLICY IF EXISTS "ticket_attachments_support" ON ticket_attachments;
CREATE POLICY "ticket_attachments_support" ON ticket_attachments
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT','PLATFORM_ADMIN'));

-- 3. Add missing FRAUD_ANALYST role to enum if it was removed
-- First check if the role exists in the enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'app_role' AND enumlabel = 'FRAUD_ANALYST')::text = 'FRAUD_ANALYST') THEN
    ALTER TYPE app_role ADD VALUE 'FRAUD_ANALYST';
  END IF;
END $$;

-- 4. Add FRAUD_ANALYST to appropriate RLS policies
-- fraud_reviews should include FRAUD_ANALYST
DROP POLICY IF EXISTS "fraud_elevated" ON fraud_reviews;
CREATE POLICY "fraud_elevated" ON fraud_reviews
  FOR SELECT USING (get_role() IN ('FRAUD_ANALYST','CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN'));

DROP POLICY IF EXISTS "fraud_risk_factors_elevated" ON fraud_risk_factors;
CREATE POLICY "fraud_risk_factors_elevated" ON fraud_risk_factors
  FOR SELECT USING (
    fraud_review_id IN (SELECT id FROM fraud_reviews) AND
    get_role() IN ('FRAUD_ANALYST','CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN')
  );

DROP POLICY IF EXISTS "fraud_review_history_elevated" ON fraud_review_history;
CREATE POLICY "fraud_review_history_elevated" ON fraud_review_history
  FOR SELECT USING (
    fraud_review_id IN (SELECT id FROM fraud_reviews) AND
    get_role() IN ('FRAUD_ANALYST','CUSTOMER_SUPPORT','OPERATIONS','PLATFORM_ADMIN')
  );

-- 5. Add missing policies for FRAUD_ANALYST on complaints
DROP POLICY IF EXISTS "complaints_elevated" ON complaints;
CREATE POLICY "complaints_elevated" ON complaints
  FOR SELECT USING (get_role() IN ('FRAUD_ANALYST','OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- 6. Ensure all tables have RLS enabled
DO $$
BEGIN
  -- Enable RLS on tables that might have been missed
  ALTER TABLE failed_automation ENABLE ROW LEVEL SECURITY;
  ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE support_ticket_history ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;
  ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
END $$;

-- 7. Add missing policies for customer data protection
-- Ensure customers can only be updated by service role (admin operations)
DROP POLICY IF EXISTS "customers_elevated" ON customers;
CREATE POLICY "customers_elevated" ON customers
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- 8. Ensure orders have proper customer isolation
DROP POLICY IF EXISTS "orders_elevated" ON orders;
CREATE POLICY "orders_elevated" ON orders
  FOR SELECT USING (get_role() IN ('OPERATIONS','CUSTOMER_SUPPORT','EXECUTIVE','PLATFORM_ADMIN'));

-- 9. Verify RLS is enabled on all sensitive tables
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'stores', 'store_metrics_snapshots', 'customers', 'orders', 
    'complaints', 'complaint_status_history', 'complaint_comments', 
    'work_orders', 'alerts', 'fraud_reviews', 'fraud_risk_factors', 
    'fraud_review_history', 'pulse_scores', 'notifications', 'audit_logs',
    'failed_automation', 'support_tickets', 'support_ticket_history',
    'ticket_activity', 'ticket_attachments', 'complaint_attachments'
  )
ORDER BY tablename;