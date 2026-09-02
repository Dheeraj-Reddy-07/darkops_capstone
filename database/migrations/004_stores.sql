-- Create stores table
CREATE TABLE stores (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  city                  TEXT NOT NULL,
  zone                  TEXT NOT NULL,
  manager_name          TEXT NOT NULL,
  manager_profile_id    UUID REFERENCES profiles(id),
  pickers_on_shift      INT NOT NULL DEFAULT 12,
  riders_assigned       INT NOT NULL DEFAULT 8,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Store metrics snapshots
CREATE TABLE store_metrics_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              TEXT NOT NULL REFERENCES stores(id),
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_pct               NUMERIC(5,2) NOT NULL,
  refund_rate_pct       NUMERIC(5,2) NOT NULL,
  avg_resolution_mins   INT NOT NULL,
  open_issues           INT NOT NULL DEFAULT 0,
  equipment_failures_14d INT NOT NULL DEFAULT 0,
  inventory_issues      INT NOT NULL DEFAULT 0,
  delivery_delays       INT NOT NULL DEFAULT 0,
  picker_delay_mins     NUMERIC(4,1) NOT NULL DEFAULT 2.5
);
