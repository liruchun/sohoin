-- Idempotent member writes: retries must not create duplicate posts or notifications.
CREATE TABLE member_publications (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 kind text NOT NULL CHECK(kind IN ('post','comment')),
 public_id varchar(10) NOT NULL CHECK(public_id ~ '^[a-z0-9]{10}$' AND public_id ~ '[a-z]'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_id)
);
CREATE TABLE member_publication_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK(kind IN ('post','comment')),
 object_id bigint NOT NULL,
 action text NOT NULL CHECK(action IN ('created','updated','deleted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
