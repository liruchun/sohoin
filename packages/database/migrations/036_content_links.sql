CREATE TABLE content_links (
 content_id bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position BETWEEN 0 AND 8),
 url text NOT NULL CHECK (length(url) <= 2048),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
 image_url text NOT NULL DEFAULT '' CHECK (length(image_url) <= 2048),
 icon_url text NOT NULL DEFAULT '' CHECK (length(icon_url) <= 2048),
 cover_media_id bigint REFERENCES media_assets(id) ON DELETE RESTRICT,
 PRIMARY KEY(content_id, position),
 UNIQUE(content_id, url)
);
CREATE INDEX content_links_cover ON content_links(cover_media_id) WHERE cover_media_id IS NOT NULL;
