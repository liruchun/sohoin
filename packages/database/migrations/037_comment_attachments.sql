-- An attachment belongs to exactly one post/article or comment. Existing
-- content references and their IDs remain intact.
ALTER TABLE content_media
 ALTER COLUMN content_id DROP NOT NULL,
 ADD COLUMN comment_id bigint REFERENCES comments(id) ON DELETE CASCADE,
 ADD CONSTRAINT content_media_one_owner CHECK (num_nonnulls(content_id,comment_id)=1),
 ADD CONSTRAINT comment_media_gallery CHECK (comment_id IS NULL OR (role='gallery' AND position BETWEEN 0 AND 8)),
 ADD CONSTRAINT comment_media_unique_asset UNIQUE(comment_id,media_id,role),
 ADD CONSTRAINT comment_media_unique_position UNIQUE(comment_id,role,position);

ALTER TABLE content_links DROP CONSTRAINT content_links_pkey;
ALTER TABLE content_links
 ALTER COLUMN content_id DROP NOT NULL,
 ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ADD COLUMN comment_id bigint REFERENCES comments(id) ON DELETE CASCADE,
 ADD CONSTRAINT content_links_one_owner CHECK (num_nonnulls(content_id,comment_id)=1),
 ADD CONSTRAINT content_links_content_position UNIQUE(content_id,position),
 ADD CONSTRAINT content_links_comment_position UNIQUE(comment_id,position),
 ADD CONSTRAINT content_links_comment_url UNIQUE(comment_id,url);
