CREATE TABLE badges (
  key text PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 64 AND key ~ '^[a-z][a-z0-9_-]*$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  description text NOT NULL DEFAULT '' CHECK (length(description)<=500),
  enabled boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  badge_key text NOT NULL REFERENCES badges(key) ON DELETE RESTRICT,
  active boolean NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  awarded_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY(user_id,badge_key),
  CHECK ((active AND revoked_at IS NULL) OR (NOT active AND revoked_at IS NOT NULL))
);
CREATE INDEX user_badges_active_cursor_idx ON user_badges(user_id,badge_key) WHERE active;
CREATE INDEX user_badges_badge_idx ON user_badges(badge_key);

CREATE TABLE badge_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  badge_key text NOT NULL REFERENCES badges(key) ON DELETE RESTRICT,
  user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
  operation text NOT NULL CHECK (operation IN ('create','update','grant','revoke')),
  actor_kind text NOT NULL CHECK (actor_kind IN ('system','admin')),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  idempotency_key text CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  request jsonb NOT NULL CHECK (jsonb_typeof(request)='object' AND octet_length(request::text)<=8192),
  before_value jsonb CHECK (before_value IS NULL OR (jsonb_typeof(before_value)='object' AND octet_length(before_value::text)<=8192)),
  after_value jsonb NOT NULL CHECK (jsonb_typeof(after_value)='object' AND octet_length(after_value::text)<=8192),
  changed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,idempotency_key),
  CHECK ((operation IN ('create','update') AND user_id IS NULL AND idempotency_key IS NULL AND actor_kind='admin')
    OR (operation IN ('grant','revoke') AND user_id IS NOT NULL AND idempotency_key IS NOT NULL))
);
CREATE INDEX badge_audit_badge_cursor_idx ON badge_audit(badge_key,id DESC);
CREATE INDEX badge_audit_user_cursor_idx ON badge_audit(user_id,id DESC);
CREATE FUNCTION reject_badge_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Badge audit is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER badge_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON badge_audit
FOR EACH STATEMENT EXECUTE FUNCTION reject_badge_audit_mutation();
