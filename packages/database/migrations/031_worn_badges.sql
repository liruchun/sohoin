CREATE TABLE user_worn_badges (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  badge_key text,
  award_revision integer,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  FOREIGN KEY(user_id,badge_key) REFERENCES user_badges(user_id,badge_key) ON DELETE RESTRICT,
  CHECK ((badge_key IS NULL AND award_revision IS NULL) OR (badge_key IS NOT NULL AND award_revision IS NOT NULL AND award_revision > 0))
);
CREATE TABLE worn_badge_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  before_key text REFERENCES badges(key) ON DELETE RESTRICT,
  after_key text REFERENCES badges(key) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX worn_badge_audit_user_idx ON worn_badge_audit(user_id,id DESC);
CREATE TRIGGER worn_badge_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON worn_badge_audit
FOR EACH STATEMENT EXECUTE FUNCTION reject_badge_audit_mutation();
