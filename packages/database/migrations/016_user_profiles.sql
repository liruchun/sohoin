CREATE TABLE user_profiles (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 bio text NOT NULL DEFAULT '' CHECK(length(bio)<=500),
 homepage text NOT NULL DEFAULT '' CHECK(length(homepage)<=500 AND (homepage='' OR homepage ~ '^https://')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_extensions (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 schema_version integer NOT NULL CHECK(schema_version BETWEEN 1 AND 32767),
 data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=16384)
);
CREATE TABLE user_profile_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 target_id text REFERENCES "user"(id) ON DELETE SET NULL,
 changed_fields text[] NOT NULL CHECK(cardinality(changed_fields)<=3),
 created_at timestamptz NOT NULL DEFAULT now()
);
