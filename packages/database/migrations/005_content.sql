CREATE TABLE content_categories (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 0
);
CREATE TABLE content_tags (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 0
);
CREATE INDEX content_categories_name_idx ON content_categories (lower(name) text_pattern_ops);
CREATE INDEX content_tags_name_idx ON content_tags (lower(name) text_pattern_ops);
CREATE TABLE contents (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 type text NOT NULL, title text NOT NULL, excerpt text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '',
 category_id bigint REFERENCES content_categories(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('draft','published','archived')),
 author_id text NOT NULL, version integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 CHECK(status<>'published' OR (category_id IS NOT NULL AND length(trim(body))>0))
);
CREATE INDEX contents_status_cursor_idx ON contents(status,id DESC);
CREATE INDEX contents_category_cursor_idx ON contents(category_id,id DESC);
CREATE INDEX contents_type_cursor_idx ON contents(type,id DESC);
CREATE INDEX contents_title_prefix_idx ON contents(lower(title) text_pattern_ops);
CREATE TABLE content_tag_links (
 content_id bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 tag_id bigint NOT NULL REFERENCES content_tags(id) ON DELETE RESTRICT,
 PRIMARY KEY(content_id,tag_id)
);
CREATE INDEX content_tags_reverse_idx ON content_tag_links(tag_id,content_id);
CREATE TABLE content_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text NOT NULL, kind text NOT NULL CHECK(kind IN ('content','categories','tags')),
 object_id text NOT NULL, label text NOT NULL,
 action text NOT NULL CHECK(action IN ('created','updated','deleted')),
 created_at timestamptz NOT NULL DEFAULT now()
);
