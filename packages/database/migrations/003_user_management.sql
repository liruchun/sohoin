-- Separate optimistic version; authentication may update updatedAt independently.
ALTER TABLE "user" ADD COLUMN admin_version integer NOT NULL DEFAULT 0;
CREATE INDEX user_name_prefix_idx ON "user" (lower(name) text_pattern_ops);
CREATE INDEX user_email_prefix_idx ON "user" (lower(email) text_pattern_ops);
CREATE TABLE user_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  target_id text NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_admin_audit_target_idx ON user_admin_audit (target_id,id DESC);
