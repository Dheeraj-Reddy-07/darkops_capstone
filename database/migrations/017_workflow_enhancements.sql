-- Migration: Add workflow enhancements for full complaint automation
-- This adds support for reorder requests, urgency scoring, sentiment analysis, and failed automation tracking

-- 1. Add REORDER to complaint_type enum
ALTER TYPE complaint_type ADD VALUE 'reorder';

-- 2. Add urgency_score and sentiment fields to complaints table
ALTER TABLE complaints 
ADD COLUMN urgency_score INTEGER DEFAULT 50 CHECK (urgency_score BETWEEN 0 AND 100),
ADD COLUMN sentiment TEXT DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
ADD COLUMN automated_routing BOOLEAN DEFAULT false,
ADD COLUMN automation_result TEXT;

-- 3. Create failed_automation table to track complaints that couldn't be auto-processed
CREATE TABLE IF NOT EXISTS failed_automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  failure_reason TEXT NOT NULL,
  failure_step TEXT NOT NULL, -- 'classification', 'refund_validation', 'auto_assignment', etc.
  urgency_score INTEGER NOT NULL,
  sentiment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES profiles(id),
  notes TEXT
);

-- 4. Create index on failed_automation for urgency-based sorting
CREATE INDEX idx_failed_automation_urgency ON failed_automation(urgency_score DESC, created_at DESC);
CREATE INDEX idx_failed_automation_resolved ON failed_automation(resolved_at) WHERE resolved_at IS NULL;

-- 4. Create support_tickets table for JIRA-level ticket management
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  complaint_id TEXT REFERENCES complaints(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'awaiting_customer', 'escalated', 'resolved', 'closed')),
  priority TEXT DEFAULT 'P3' CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  queue TEXT DEFAULT 'general' CHECK (queue IN ('general', 'refunds', 'reorders', 'operational', 'escalated')),
  sla_deadline TIMESTAMP WITH TIME ZONE,
  resolution_time_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT
);

-- 6. Create indexes for support_tickets
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to, status);
CREATE INDEX idx_support_tickets_queue ON support_tickets(queue, status, priority);
CREATE INDEX idx_support_tickets_sla ON support_tickets(sla_deadline) WHERE status IN ('open', 'in_progress');

-- 7. Create support_ticket_history table for audit trail
CREATE TABLE IF NOT EXISTS support_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_assigned_to UUID REFERENCES profiles(id),
  new_assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create index for ticket history
CREATE INDEX idx_ticket_history_ticket ON support_ticket_history(ticket_id, occurred_at DESC);

-- 9. Add RLS policies for failed_automation
ALTER TABLE failed_automation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "failed_automation_support" ON failed_automation
  FOR SELECT USING (get_role() = 'CUSTOMER_SUPPORT');

CREATE POLICY "failed_automation_admin" ON failed_automation
  FOR ALL USING (get_role() = 'PLATFORM_ADMIN');

-- 10. Add RLS policies for support_tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_tickets_own" ON support_tickets
  FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "support_tickets_support" ON support_tickets
  FOR ALL USING (get_role() = 'CUSTOMER_SUPPORT');

CREATE POLICY "support_tickets_admin" ON support_tickets
  FOR ALL USING (get_role() = 'PLATFORM_ADMIN');

-- 11. Add RLS policies for support_ticket_history
ALTER TABLE support_ticket_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_history_support" ON support_ticket_history
  FOR SELECT USING (get_role() = 'CUSTOMER_SUPPORT');

CREATE POLICY "ticket_history_admin" ON support_ticket_history
  FOR ALL USING (get_role() = 'PLATFORM_ADMIN');
