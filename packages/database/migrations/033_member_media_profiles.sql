CREATE TABLE member_media (
 media_id bigint PRIMARY KEY REFERENCES media_assets(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 public_id text NOT NULL UNIQUE CHECK(public_id ~ '^[a-z0-9]{10}$' AND public_id ~ '[a-z]'),
 source_checksum text NOT NULL CHECK(source_checksum ~ '^[a-f0-9]{64}$'),
 UNIQUE(user_id,source_checksum)
);
CREATE INDEX member_media_owner ON member_media(user_id,media_id DESC);
ALTER TABLE user_profiles ADD COLUMN region text NOT NULL DEFAULT '' CHECK(length(region)<=100);
ALTER TABLE user_profiles ADD COLUMN contact_visibility text NOT NULL DEFAULT 'friends' CHECK(contact_visibility IN ('public','friends','hidden'));
CREATE TABLE user_contacts (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('wechat','line','qq','feishu','whatsapp','email','discord','telegram','phone')),
 value text NOT NULL DEFAULT '' CHECK(length(value)<=200),
 media_id bigint REFERENCES media_assets(id) ON DELETE RESTRICT,
 PRIMARY KEY(user_id,kind),
 CHECK((kind IN ('wechat','line','qq','feishu') AND media_id IS NOT NULL AND value='') OR (kind IN ('whatsapp','email','discord','telegram','phone') AND media_id IS NULL AND value<>''))
);
CREATE INDEX user_contacts_media ON user_contacts(media_id) WHERE media_id IS NOT NULL;
ALTER TABLE user_profile_audit DROP CONSTRAINT user_profile_audit_changed_fields_check;
ALTER TABLE user_profile_audit ADD CHECK(cardinality(changed_fields)<=8);
