CREATE TABLE reaction_types (
 code text PRIMARY KEY CHECK(code ~ '^[a-z][a-z0-9_]{0,23}$'),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 24),
 emoji text NOT NULL CHECK(length(emoji) BETWEEN 1 AND 16),
 enabled boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0 CHECK(position BETWEEN 0 AND 100),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0)
);
INSERT INTO reaction_types(code,label,emoji,position) VALUES
 ('like','赞','👍',0),('love','喜欢','❤️',1),('laugh','开心','😂',2),('wow','惊讶','😮',3),('sad','难过','😢',4);

CREATE TABLE content_reactions (
 content_id bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 code text NOT NULL REFERENCES reaction_types(code) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(content_id,user_id)
);
CREATE INDEX content_reactions_count_idx ON content_reactions(content_id,code);
CREATE INDEX content_reactions_user_idx ON content_reactions(user_id);
CREATE TABLE comment_reactions (
 comment_id bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 code text NOT NULL REFERENCES reaction_types(code) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(comment_id,user_id)
);
CREATE INDEX comment_reactions_count_idx ON comment_reactions(comment_id,code);
CREATE INDEX comment_reactions_user_idx ON comment_reactions(user_id);

CREATE TABLE content_bookmarks (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 content_id bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,content_id)
);
CREATE INDEX content_bookmarks_user_cursor_idx ON content_bookmarks(user_id,id DESC);
CREATE INDEX content_bookmarks_target_idx ON content_bookmarks(content_id);
CREATE TABLE comment_bookmarks (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 comment_id bigint NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,comment_id)
);
CREATE INDEX comment_bookmarks_user_cursor_idx ON comment_bookmarks(user_id,id DESC);
CREATE INDEX comment_bookmarks_target_idx ON comment_bookmarks(comment_id);
