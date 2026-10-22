-- Source provenance and anonymous reaction totals are separate from real user actions.
CREATE TABLE demo_imports (
 id text PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
 source_url text NOT NULL CHECK(source_url LIKE 'https://bonjour.bio/%'),
 captured_at timestamptz NOT NULL,
 dataset_hash text NOT NULL CHECK(dataset_hash ~ '^[a-f0-9]{64}$'),
 summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(summary)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo_import_objects (
 batch_id text NOT NULL REFERENCES demo_imports(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('user','content','comment','category','tag')),
 source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 100),
 local_id text NOT NULL CHECK(length(local_id) BETWEEN 1 AND 150),
 source_url text NOT NULL CHECK(source_url LIKE 'https://bonjour.bio/%'),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=262144),
 PRIMARY KEY(batch_id,kind,source_id),
 UNIQUE(kind,local_id)
);
CREATE TABLE demo_reaction_counts (
 batch_id text NOT NULL REFERENCES demo_imports(id) ON DELETE CASCADE,
 content_id bigint REFERENCES contents(id) ON DELETE CASCADE,
 comment_id bigint REFERENCES comments(id) ON DELETE CASCADE,
 code text NOT NULL REFERENCES reaction_types(code) ON DELETE RESTRICT,
 count integer NOT NULL CHECK(count BETWEEN 1 AND 1000000),
 CHECK((content_id IS NULL)<>(comment_id IS NULL)),
 UNIQUE NULLS NOT DISTINCT(content_id,comment_id,code)
);
CREATE INDEX demo_reactions_content_idx ON demo_reaction_counts(content_id,code) WHERE content_id IS NOT NULL;
CREATE INDEX demo_reactions_comment_idx ON demo_reaction_counts(comment_id,code) WHERE comment_id IS NOT NULL;
CREATE INDEX demo_reactions_batch_idx ON demo_reaction_counts(batch_id);
