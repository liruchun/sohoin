CREATE INDEX session_user_cursor_idx ON "session" ("userId", id DESC);
CREATE TABLE account_security_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('password_changed','session_revoked','other_sessions_revoked')),
  affected_sessions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
