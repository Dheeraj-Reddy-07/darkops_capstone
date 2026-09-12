-- Migration 022: Add ticket_id to complaints table
-- This enables the automation engine to find and update the existing ticket
-- rather than creating duplicates on escalation.
--
-- Note: sla_due_at already exists on complaints from migration 006.
-- The automation engine will now write to sla_due_at when it determines SLA deadline.

-- 1. Add ticket_id to complaints (soft foreign key to support_tickets, nullable)
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL;

-- 2. Add index for ticket_id lookup
CREATE INDEX IF NOT EXISTS idx_complaints_ticket_id ON complaints(ticket_id);

-- 3. Add index for sla_due_at breach queries
CREATE INDEX IF NOT EXISTS idx_complaints_sla_due_at ON complaints(sla_due_at) WHERE status IN ('unassigned', 'assigned', 'in_progress');
