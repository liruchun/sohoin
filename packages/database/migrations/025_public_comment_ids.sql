-- Stable public comment addresses; keep content/comment storage and existing tokens intact.
CREATE TABLE public_comment_ids (
 comment_id bigint PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
 short_id varchar(10) NOT NULL UNIQUE CHECK(short_id ~ '^[a-z0-9]{10}$' AND short_id ~ '[a-z]')
);
CREATE INDEX comments_direct_reply_cursor_idx ON comments(reply_to_id,id DESC)
 WHERE status='visible' AND NOT thread_hidden;
