-- Migration 019: Support Agent Workspace
-- Adds title field, ticket_activity table, ticket_attachments table,
-- and fixes RLS policies so CUSTOMER_SUPPORT agents can access their workspace.

-- 1. Add title column to support_tickets (human-readable issue title)
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Backfill title from complaint summary for existing tickets
UPDATE support_tickets st
SET title = c.summary
FROM complaints c
WHERE st.complaint_id = c.id
  AND st.title IS NULL;

-- 2. Create ticket_activity table (richer event log than support_ticket_history)
CREATE TABLE IF NOT EXISTS ticket_activity (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES profiles(id),
  event_type      TEXT NOT NULL,  -- 'created','assigned','status_changed','note_added','resolved','attachment_added'
  payload         JSONB DEFAULT '{}',
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket
  ON ticket_activity(ticket_id, created_at ASC);

-- 3. Create ticket_attachments table
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  file_type       TEXT,
  file_size_bytes INTEGER,
  uploaded_by     UUID REFERENCES profiles(id),
  uploaded_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket
  ON ticket_attachments(ticket_id, uploaded_at DESC);

-- 4. RLS for ticket_activity
ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;

-- Agents can see activity for their own tickets or any ticket if CUSTOMER_SUPPORT
CREATE POLICY "ticket_activity_own" ON ticket_activity
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE assigned_to = auth.uid()
    )
  );

CREATE POLICY "ticket_activity_support" ON ticket_activity
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT', 'PLATFORM_ADMIN'));

-- 5. RLS for ticket_attachments
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_attachments_own" ON ticket_attachments
  FOR SELECT USING (
    ticket_id IN (
      SELECT id FROM support_tickets WHERE assigned_to = auth.uid()
    )
    OR uploaded_by = auth.uid()
  );

CREATE POLICY "ticket_attachments_support" ON ticket_attachments
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT', 'PLATFORM_ADMIN'));

-- 6. Fix existing support_tickets RLS to allow CUSTOMER_SUPPORT ALL
-- (Drop and recreate to avoid duplicate policy names safely)
DROP POLICY IF EXISTS "support_tickets_support" ON support_tickets;
CREATE POLICY "support_tickets_support" ON support_tickets
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT', 'PLATFORM_ADMIN'));

-- 7. Fix existing support_ticket_history RLS for CUSTOMER_SUPPORT
DROP POLICY IF EXISTS "ticket_history_support" ON support_ticket_history;
CREATE POLICY "ticket_history_support" ON support_ticket_history
  FOR SELECT USING (get_role() IN ('CUSTOMER_SUPPORT', 'PLATFORM_ADMIN'));

-- 8. Fix failed_automation RLS for CUSTOMER_SUPPORT
DROP POLICY IF EXISTS "failed_automation_support" ON failed_automation;
CREATE POLICY "failed_automation_support" ON failed_automation
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT', 'PLATFORM_ADMIN'));

-- 9. Allow OPERATIONS role to read support_tickets (team visibility)
DROP POLICY IF EXISTS "support_tickets_operations_read" ON support_tickets;
CREATE POLICY "support_tickets_operations_read" ON support_tickets
  FOR SELECT USING (get_role() = 'OPERATIONS');
