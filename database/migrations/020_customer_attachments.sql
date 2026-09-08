-- Migration 020: Customer Complaint Attachments
-- Adds complaint_attachments table for customer evidence uploads
-- and updates complaint status to support customer-facing workflow

-- 1. Create complaint_attachments table
CREATE TABLE IF NOT EXISTS complaint_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  file_type       TEXT,
  file_size_bytes INTEGER,
  uploaded_by     UUID REFERENCES profiles(id),
  uploaded_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint
  ON complaint_attachments(complaint_id, uploaded_at DESC);

-- 2. RLS for complaint_attachments
ALTER TABLE complaint_attachments ENABLE ROW LEVEL SECURITY;

-- Customers can see attachments for their own complaints
CREATE POLICY "complaint_attachments_customer" ON complaint_attachments
  FOR SELECT USING (
    complaint_id IN (
      SELECT id FROM complaints WHERE customer_id = get_customer_id()
    )
  );

-- Support agents and elevated roles can see all attachments
CREATE POLICY "complaint_attachments_elevated" ON complaint_attachments
  FOR ALL USING (get_role() IN ('CUSTOMER_SUPPORT', 'OPERATIONS', 'EXECUTIVE', 'PLATFORM_ADMIN'));

-- Customers can upload attachments to their own complaints
CREATE POLICY "complaint_attachments_customer_insert" ON complaint_attachments
  FOR INSERT WITH CHECK (
    complaint_id IN (
      SELECT id FROM complaints WHERE customer_id = get_customer_id()
    )
    AND uploaded_by = auth.uid()
  );

-- 3. Update complaint status enum to include customer-facing states
-- Note: This requires updating the enum type which may need manual execution in Supabase
-- For now, we'll use the existing status field and map it in the application layer

-- 4. Add customer-friendly status mapping function
CREATE OR REPLACE FUNCTION get_customer_friendly_status(complaint_status TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN complaint_status = 'unassigned' THEN 'Received'
    WHEN complaint_status = 'assigned' THEN 'Under Review'
    WHEN complaint_status = 'in_progress' THEN 'In Progress'
    WHEN complaint_status = 'awaiting_customer' THEN 'Waiting for Your Response'
    WHEN complaint_status = 'resolved' THEN 'Resolved'
    WHEN complaint_status = 'closed' THEN 'Closed'
    ELSE complaint_status
  END;
$$;
