ALTER TABLE badges ADD COLUMN icon_media_id bigint REFERENCES media_assets(id) ON DELETE RESTRICT;
CREATE INDEX badges_icon_media_idx ON badges(icon_media_id) WHERE icon_media_id IS NOT NULL;
CREATE INDEX badge_audit_grant_lookup_idx ON badge_audit(user_id,badge_key,id DESC) WHERE operation='grant' AND changed;
