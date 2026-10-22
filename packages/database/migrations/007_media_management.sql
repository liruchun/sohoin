ALTER TABLE media_assets ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
CREATE INDEX media_assets_ready_cursor_idx ON media_assets(id DESC) WHERE status='ready';
CREATE TABLE media_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 media_id bigint NOT NULL,
 label text NOT NULL CHECK(length(label)<=255),
 action text NOT NULL CHECK(action IN ('uploaded','deleted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
