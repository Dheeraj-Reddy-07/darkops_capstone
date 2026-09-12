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
