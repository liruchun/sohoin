-- References are paged by link id, independently of content ids and role order.
CREATE INDEX content_media_reference_cursor_idx ON content_media(media_id,id DESC);
