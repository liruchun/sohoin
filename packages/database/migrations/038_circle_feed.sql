-- Shared chronological post scan and current visible comment membership.
-- Reactions and follows already have target/user composite primary keys.
CREATE INDEX contents_public_feed_cursor_idx ON contents(published_at DESC,id DESC)
 WHERE status='published' AND type IN ('post','article');
CREATE INDEX comments_circle_content_idx ON comments(content_id,author_id,id)
 INCLUDE(root_id) WHERE status='visible' AND NOT thread_hidden;
