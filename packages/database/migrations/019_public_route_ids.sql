-- Persist encrypted public URLs; internal identifiers and existing API contracts stay intact.
CREATE TABLE public_route_ids (
 kind text NOT NULL CHECK(kind IN ('content','user')),
 content_id bigint REFERENCES contents(id) ON DELETE CASCADE,
 user_id text REFERENCES "user"(id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE CHECK(token ~ '^d1_[A-Za-z0-9_-]{39,220}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='content' AND content_id IS NOT NULL AND user_id IS NULL)
    OR (kind='user' AND user_id IS NOT NULL AND content_id IS NULL)),
 UNIQUE NULLS NOT DISTINCT(kind,content_id,user_id)
);
CREATE INDEX public_route_content_idx ON public_route_ids(content_id) WHERE content_id IS NOT NULL;
CREATE INDEX public_route_user_idx ON public_route_ids(user_id) WHERE user_id IS NOT NULL;
