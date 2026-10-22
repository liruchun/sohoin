-- Additive foundation; no file upload endpoints or storage credentials are introduced.
ALTER TABLE contents ADD CONSTRAINT contents_title_by_type CHECK(type='post' OR length(btrim(title))>0);
ALTER TABLE contents ADD CONSTRAINT contents_post_body CHECK(type<>'post' OR length(btrim(body))>0);
ALTER TABLE contents ADD COLUMN feed_text text GENERATED ALWAYS AS
 (CASE WHEN type='post' AND excerpt='' THEN left(body,280) ELSE excerpt END) STORED;

CREATE TABLE content_extensions (
 content_id bigint PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
 schema_version integer NOT NULL CHECK(schema_version BETWEEN 1 AND 32767),
 data jsonb NOT NULL DEFAULT '{}'::jsonb,
 CHECK(jsonb_typeof(data)='object'),
 CHECK(octet_length(data::text)<=16384)
);

CREATE TABLE media_assets (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 uploader_id text REFERENCES "user"(id) ON DELETE SET NULL,
 storage_provider text NOT NULL CHECK(length(storage_provider) BETWEEN 1 AND 40),
 storage_namespace text NOT NULL CHECK(length(storage_namespace) BETWEEN 1 AND 120),
 storage_key text NOT NULL CHECK(length(storage_key) BETWEEN 1 AND 1024),
 original_name text NOT NULL CHECK(length(original_name)<=255),
 kind text NOT NULL CHECK(kind IN ('image','video','audio','document')),
 mime_type text NOT NULL CHECK(length(mime_type) BETWEEN 1 AND 128),
 byte_size bigint CHECK(byte_size>0),
 width integer CHECK(width>0), height integer CHECK(height>0),
 duration_ms bigint CHECK(duration_ms>=0),
 checksum_sha256 text CHECK(checksum_sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','ready','failed','deleted')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,
 UNIQUE(storage_provider,storage_namespace,storage_key),
 CHECK((width IS NULL)=(height IS NULL)),
 CHECK(status<>'ready' OR byte_size IS NOT NULL),
 CHECK(status<>'ready' OR kind NOT IN ('image','video') OR (width IS NOT NULL AND height IS NOT NULL)),
 CHECK((status='deleted')=(deleted_at IS NOT NULL))
);
CREATE INDEX media_assets_owner_cursor_idx ON media_assets(uploader_id,id DESC);
CREATE INDEX media_assets_cleanup_idx ON media_assets(status,created_at,id) WHERE status IN ('pending','failed','deleted');

CREATE TABLE media_variants (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 media_id bigint NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
 variant_key text NOT NULL CHECK(length(variant_key) BETWEEN 1 AND 80),
 storage_provider text NOT NULL CHECK(length(storage_provider) BETWEEN 1 AND 40),
 storage_namespace text NOT NULL CHECK(length(storage_namespace) BETWEEN 1 AND 120),
 storage_key text NOT NULL CHECK(length(storage_key) BETWEEN 1 AND 1024),
 mime_type text NOT NULL CHECK(length(mime_type) BETWEEN 1 AND 128),
 byte_size bigint CHECK(byte_size>0),width integer CHECK(width>0),height integer CHECK(height>0),
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','ready','failed','deleted')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(media_id,variant_key),UNIQUE(storage_provider,storage_namespace,storage_key),
 CHECK((width IS NULL)=(height IS NULL)),
 CHECK(status<>'ready' OR byte_size IS NOT NULL),
 CHECK(status<>'ready' OR mime_type NOT LIKE 'image/%' OR (width IS NOT NULL AND height IS NOT NULL))
);

CREATE TABLE content_media (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 content_id bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 media_id bigint NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('cover','gallery','attachment')),
 position integer NOT NULL DEFAULT 0 CHECK(position>=0),
 alt_text text NOT NULL DEFAULT '' CHECK(length(alt_text)<=500),
 caption text NOT NULL DEFAULT '' CHECK(length(caption)<=1000),
 UNIQUE(content_id,role,position),
 CHECK(role<>'cover' OR position=0)
);
CREATE UNIQUE INDEX content_media_cover_idx ON content_media(content_id) WHERE role='cover';
CREATE INDEX content_media_reverse_idx ON content_media(media_id,content_id);
