-- Work orders table
CREATE TABLE work_orders (
  id              TEXT PRIMARY KEY,
  store_id        TEXT NOT NULL REFERENCES stores(id),
  asset_id        TEXT NOT NULL,
  asset_name      TEXT NOT NULL,
  priority        priority_level NOT NULL,
  status          work_order_status NOT NULL DEFAULT 'open',
  sla_due_at      TIMESTAMPTZ,
  assigned_to     UUID REFERENCES profiles(id),
  description     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Network alerts
CREATE TABLE alerts (
  id              TEXT PRIMARY KEY,
  store_id        TEXT REFERENCES stores(id),
  title           TEXT NOT NULL,
  detail          TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('crit','warn','info')),
  is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
