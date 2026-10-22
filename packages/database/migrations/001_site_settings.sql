CREATE TABLE site_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO site_settings (id) VALUES (1);
CREATE TABLE settings_audit (
  id bigserial PRIMARY KEY, actor_id text NOT NULL,
  before_value jsonb NOT NULL, after_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE request_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX request_limits_expiry ON request_limits(expires_at);
