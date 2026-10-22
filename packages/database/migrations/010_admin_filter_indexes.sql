-- Measured on 30k users: rare admin/banned filters scanned nearly the whole PK.
-- Small partial indexes preserve write costs for the ordinary active population.
CREATE INDEX user_admin_cursor_idx ON "user"(id DESC)
 WHERE 'admin'=ANY(string_to_array(COALESCE(role,'user'),','));
CREATE INDEX user_banned_cursor_idx ON "user"(id DESC) WHERE COALESCE(banned,false);
