-- Local avatar references share the existing user image field; protect lookups as the user table grows.
CREATE INDEX user_local_image_idx ON "user"(image) WHERE image LIKE '/api/site-media/%';
