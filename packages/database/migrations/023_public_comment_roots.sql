-- Public thread pagination must not scan all replies to find the next ten roots.
CREATE INDEX comments_public_roots_cursor_idx ON comments(content_id,id DESC)
 WHERE root_id IS NULL AND status='visible' AND NOT thread_hidden;
