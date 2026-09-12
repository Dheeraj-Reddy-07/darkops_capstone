-- Pulse scores table
CREATE TABLE pulse_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          TEXT NOT NULL REFERENCES stores(id),
  score             INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  equipment_pts     INT NOT NULL DEFAULT 0 CHECK (equipment_pts BETWEEN 0 AND 25),
  sla_pts           INT NOT NULL DEFAULT 0 CHECK (sla_pts BETWEEN 0 AND 25),
  refunds_pts       INT NOT NULL DEFAULT 0 CHECK (refunds_pts BETWEEN 0 AND 20),
  delivery_pts      INT NOT NULL DEFAULT 0 CHECK (delivery_pts BETWEEN 0 AND 15),
  picker_pts        INT NOT NULL DEFAULT 0 CHECK (picker_pts BETWEEN 0 AND 10),
  inventory_pts     INT NOT NULL DEFAULT 0 CHECK (inventory_pts BETWEEN 0 AND 10),
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_score CHECK (
    score = GREATEST(12, 100 - (equipment_pts + sla_pts + refunds_pts + delivery_pts + picker_pts + inventory_pts))
  )
);
