-- Category identity and explicit membership. Icons reuse the existing media
-- pipeline; deleting an image used as a category icon requires reassignment.
ALTER TABLE content_categories ADD COLUMN icon_media_id bigint REFERENCES media_assets(id) ON DELETE RESTRICT;
CREATE INDEX content_categories_icon_idx ON content_categories (icon_media_id) WHERE icon_media_id IS NOT NULL;

CREATE TABLE content_category_members (
 category_id bigint NOT NULL REFERENCES content_categories(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (category_id, user_id)
);
-- User-side membership lists and the user_id cascade both use this index.
CREATE INDEX content_category_members_user_idx ON content_category_members (user_id, created_at DESC, category_id);
