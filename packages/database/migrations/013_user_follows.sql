CREATE TABLE user_follows (
 follower_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 following_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(follower_id,following_id),
 CHECK(follower_id<>following_id)
);
CREATE INDEX user_follows_following_cursor_idx ON user_follows(follower_id,id DESC) INCLUDE(following_id,created_at);
CREATE INDEX user_follows_followers_cursor_idx ON user_follows(following_id,id DESC) INCLUDE(follower_id,created_at);
