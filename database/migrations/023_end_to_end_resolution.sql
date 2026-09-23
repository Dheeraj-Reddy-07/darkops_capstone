-- Migration: End-to-End Resolution Architecture
-- Adds requested_resolution, resolution_decision, and execution_handoffs table for signed, idempotent downstream resolution handoffs

-- 1. Add requested_resolution and resolution_decision fields to complaints table
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS requested_resolution TEXT CHECK (requested_resolution IN ('REFUND', 'REPLACEMENT', 'SUPPORT_REVIEW', 'INFORMATION_ONLY')) DEFAULT 'SUPPORT_REVIEW',
ADD COLUMN IF NOT EXISTS resolution_decision TEXT CHECK (resolution_decision IN ('REFUND', 'REPLACEMENT', 'SUPPORT_REVIEW', 'NO_ACTION')),
ADD COLUMN IF NOT EXISTS resolution_decision_reason TEXT,
ADD COLUMN IF NOT EXISTS resolution_decided_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS resolution_decided_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS execution_handoff_id UUID;

-- 2. Create execution_handoffs table
CREATE TABLE IF NOT EXISTS execution_handoffs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id         TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  order_id             TEXT NOT NULL REFERENCES orders(id),
  resolution_type      TEXT NOT NULL CHECK (resolution_type IN ('REFUND', 'REPLACEMENT', 'SUPPORT_REVIEW', 'NO_ACTION')),
  payload              JSONB NOT NULL,
  signature            TEXT NOT NULL,
  idempotency_key      TEXT UNIQUE NOT NULL,
  status               TEXT NOT NULL DEFAULT 'HANDOFF_PENDING' CHECK (status IN ('HANDOFF_PENDING', 'HANDOFF_SENT', 'EXECUTION_ACKNOWLEDGED', 'EXECUTION_COMPLETED', 'FAILED')),
  acknowledged_at      TIMESTAMPTZ,
  downstream_reference TEXT,
  retry_count          INT NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Add foreign key for execution_handoff_id on complaints (if table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_complaints_execution_handoff'
  ) THEN
    ALTER TABLE complaints
    ADD CONSTRAINT fk_complaints_execution_handoff
    FOREIGN KEY (execution_handoff_id) REFERENCES execution_handoffs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create Indexes for execution_handoffs
CREATE INDEX IF NOT EXISTS idx_execution_handoffs_complaint ON execution_handoffs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_execution_handoffs_idempotency ON execution_handoffs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_execution_handoffs_status ON execution_handoffs(status);

-- 5. RLS policies for execution_handoffs
ALTER TABLE execution_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "execution_handoffs_customer" ON execution_handoffs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM complaints c
      JOIN customers cust ON cust.id = c.customer_id
      WHERE c.id = execution_handoffs.complaint_id
      AND cust.profile_id = auth.uid()
    )
  );

CREATE POLICY "execution_handoffs_support" ON execution_handoffs
  FOR SELECT USING (get_role() = 'CUSTOMER_SUPPORT');

CREATE POLICY "execution_handoffs_admin" ON execution_handoffs
  FOR ALL USING (get_role() = 'PLATFORM_ADMIN');
