-- Customers table
CREATE TABLE customers (
  id                TEXT PRIMARY KEY,
  profile_id        UUID UNIQUE REFERENCES profiles(id),
  full_name         TEXT NOT NULL,
  email             TEXT UNIQUE,
  phone             TEXT,
  city              TEXT,
  address           TEXT,
  prior_claims_90d  INT NOT NULL DEFAULT 0,
  upheld_claims_90d INT NOT NULL DEFAULT 0,
  account_standing  TEXT NOT NULL DEFAULT 'good' CHECK (account_standing IN ('good','restricted','banned')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
  id                TEXT PRIMARY KEY,
  customer_id       TEXT NOT NULL REFERENCES customers(id),
  store_id          TEXT NOT NULL REFERENCES stores(id),
  placed_at         TIMESTAMPTZ NOT NULL,
  status            order_status NOT NULL DEFAULT 'packing',
  total_amount_paise BIGINT NOT NULL,
  item_count        INT NOT NULL DEFAULT 0,
  items_preview     TEXT,
  delivery_partner  TEXT,
  delivery_partner_id TEXT,
  eta_at            TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
