-- Fail rather than silently truncate or rewrite existing user data.
ALTER TABLE contents ADD CONSTRAINT contents_field_bounds CHECK (
 length(type) BETWEEN 1 AND 40 AND type ~ '^[a-z][a-z0-9-]{0,39}$'
 AND length(title)<=160 AND length(excerpt)<=500 AND length(body)<=50000
 AND version>=0 AND length(author_id)>0
 AND (status<>'published' OR published_at IS NOT NULL)
);
ALTER TABLE contents ADD CONSTRAINT contents_author_fk FOREIGN KEY(author_id) REFERENCES "user"(id) ON DELETE RESTRICT;
ALTER TABLE content_categories ADD CONSTRAINT content_categories_field_bounds CHECK (
 length(btrim(name)) BETWEEN 1 AND 60 AND length(slug) BETWEEN 1 AND 80
 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(description)<=300 AND version>=0
);
ALTER TABLE content_tags ADD CONSTRAINT content_tags_field_bounds CHECK (
 length(btrim(name)) BETWEEN 1 AND 60 AND length(slug) BETWEEN 1 AND 80
 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(description)<=300 AND version>=0
);
ALTER TABLE site_settings ADD CONSTRAINT site_settings_value_shape CHECK(jsonb_typeof(value)='object' AND revision>=0);
ALTER TABLE "user" ADD CONSTRAINT user_admin_version_nonnegative CHECK(admin_version>=0);
ALTER TABLE request_limits ADD CONSTRAINT request_limits_positive CHECK(count>0);
ALTER TABLE account_security_audit ADD CONSTRAINT account_audit_sessions_nonnegative CHECK(affected_sessions>=0);
