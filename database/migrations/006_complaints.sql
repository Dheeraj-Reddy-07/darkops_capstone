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
