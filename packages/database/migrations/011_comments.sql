CREATE TABLE comments (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 content_id bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 author_id text REFERENCES "user"(id) ON DELETE SET NULL,
 root_id bigint, reply_to_id bigint,
 body text NOT NULL CHECK(length(body)<=5000),
 status text NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden','deleted')),
 thread_hidden boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,
 UNIQUE(id,content_id),
 FOREIGN KEY(root_id,content_id) REFERENCES comments(id,content_id) ON DELETE NO ACTION,
 FOREIGN KEY(reply_to_id,content_id) REFERENCES comments(id,content_id) ON DELETE NO ACTION,
 CHECK((root_id IS NULL)=(reply_to_id IS NULL)),
 CHECK(root_id IS NULL OR (root_id<>id AND reply_to_id<>id AND NOT thread_hidden)),
 CHECK((status='deleted')=(deleted_at IS NOT NULL)),
 CHECK(CASE WHEN status='deleted' THEN body='' ELSE length(btrim(body))>0 END)
);
CREATE INDEX comments_content_cursor_idx ON comments(content_id,id DESC);
CREATE INDEX comments_status_cursor_idx ON comments(status,id DESC);
CREATE INDEX comments_root_cursor_idx ON comments(root_id,id DESC) WHERE root_id IS NOT NULL;
CREATE INDEX comments_reply_target_idx ON comments(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- A reply always belongs to a true root; replying to a reply does not add a level.
CREATE FUNCTION check_comment_thread() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE thread comments%ROWTYPE; target comments%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.content_id IS DISTINCT FROM OLD.content_id
   OR NEW.root_id IS DISTINCT FROM OLD.root_id OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id THEN
   RAISE EXCEPTION 'Comment relationships are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.root_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO thread FROM comments WHERE id=NEW.root_id FOR SHARE;
 IF NOT FOUND OR thread.root_id IS NOT NULL OR thread.content_id<>NEW.content_id THEN
  RAISE EXCEPTION 'Invalid root comment' USING ERRCODE='23514';
 END IF;
 IF NEW.reply_to_id=NEW.root_id THEN target:=thread;
 ELSE SELECT * INTO target FROM comments WHERE id=NEW.reply_to_id FOR SHARE; END IF;
 IF target.id IS NULL OR target.content_id<>NEW.content_id OR target.status='deleted'
  OR (target.id<>NEW.root_id AND target.root_id IS DISTINCT FROM NEW.root_id) THEN
  RAISE EXCEPTION 'Reply target must belong to the same thread' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER comments_thread_guard BEFORE INSERT OR UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION check_comment_thread();

CREATE TABLE comment_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 comment_id bigint NOT NULL,content_id bigint NOT NULL,
 action text NOT NULL CHECK(action IN ('hide','restore','delete','hide_thread','show_thread')),
 before_status text NOT NULL CHECK(before_status IN ('visible','hidden','deleted')),
 after_status text NOT NULL CHECK(after_status IN ('visible','hidden','deleted')),
 before_thread_hidden boolean NOT NULL,after_thread_hidden boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
