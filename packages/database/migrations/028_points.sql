-- Accounts are created lazily. Retain accounting history when a user is removed.
CREATE TABLE points_accounts (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance BETWEEN 0 AND 9007199254740991),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE points_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id text NOT NULL REFERENCES points_accounts(user_id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('credit','debit','reverse')),
  amount bigint NOT NULL CHECK (amount <> 0 AND amount BETWEEN -9007199254740991 AND 9007199254740991),
  balance_after bigint NOT NULL CHECK (balance_after BETWEEN 0 AND 9007199254740991),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  source_type text NOT NULL CHECK (length(source_type) BETWEEN 1 AND 64),
  source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 200),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  actor_kind text NOT NULL CHECK (actor_kind IN ('system','admin')),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 128),
  reversal_of bigint UNIQUE REFERENCES points_entries(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id,idempotency_key),
  CHECK ((kind='credit' AND amount>0 AND reversal_of IS NULL)
      OR (kind='debit' AND amount<0 AND reversal_of IS NULL)
      OR (kind='reverse' AND reversal_of IS NOT NULL))
);
CREATE INDEX points_entries_account_cursor_idx ON points_entries(account_id,id DESC);

-- Corrections append a reversal; ordinary UPDATE/DELETE/TRUNCATE cannot erase audits.
CREATE FUNCTION reject_points_entry_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Points entries are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER points_entries_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON points_entries
FOR EACH STATEMENT EXECUTE FUNCTION reject_points_entry_mutation();
