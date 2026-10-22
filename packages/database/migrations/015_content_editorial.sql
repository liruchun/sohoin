ALTER TABLE contents ADD COLUMN featured boolean NOT NULL DEFAULT false;
ALTER TABLE contents ADD COLUMN featured_at timestamptz;
ALTER TABLE contents ADD COLUMN pin_level smallint NOT NULL DEFAULT 0 CHECK(pin_level BETWEEN 0 AND 3);
ALTER TABLE contents ADD CONSTRAINT contents_featured_time CHECK(featured=(featured_at IS NOT NULL));
CREATE INDEX contents_published_sort_idx ON contents(status,(COALESCE(published_at,'epoch'::timestamptz)) DESC,id DESC);
CREATE INDEX contents_priority_sort_idx ON contents(status,pin_level DESC,(COALESCE(published_at,'epoch'::timestamptz)) DESC,id DESC);
CREATE INDEX contents_updated_sort_idx ON contents(status,updated_at DESC,id DESC);
CREATE INDEX contents_featured_cursor_idx ON contents(status,id DESC) WHERE featured;
