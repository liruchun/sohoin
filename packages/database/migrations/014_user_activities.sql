-- Keep source mutations and activity recording in the same transaction, including
-- future comment writers. These locks close the backfill/trigger installation gap.
LOCK TABLE contents,comments,content_reactions,comment_reactions IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE user_activities (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('content_published','comment_created','content_reacted','comment_reacted')),
 content_id bigint NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
 comment_id bigint,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(comment_id,content_id) REFERENCES comments(id,content_id) ON DELETE CASCADE,
 CHECK((kind IN ('comment_created','comment_reacted'))=(comment_id IS NOT NULL)),
 UNIQUE NULLS NOT DISTINCT(actor_id,kind,content_id,comment_id)
);
CREATE INDEX user_activities_actor_cursor_idx ON user_activities(actor_id,id DESC) WHERE active;
CREATE INDEX user_activities_active_cursor_idx ON user_activities(id DESC) WHERE active;
CREATE INDEX user_activities_content_idx ON user_activities(content_id);
CREATE INDEX user_activities_comment_idx ON user_activities(comment_id) WHERE comment_id IS NOT NULL;

INSERT INTO user_activities(actor_id,kind,content_id,comment_id,created_at)
SELECT actor_id,kind,content_id,comment_id,created_at FROM (
 SELECT author_id AS actor_id,'content_published' AS kind,id AS content_id,NULL::bigint AS comment_id,published_at AS created_at FROM contents WHERE published_at IS NOT NULL
 UNION ALL SELECT author_id,'comment_created',content_id,id,created_at FROM comments WHERE author_id IS NOT NULL AND status<>'deleted'
 UNION ALL SELECT user_id,'content_reacted',content_id,NULL::bigint,created_at FROM content_reactions
 UNION ALL SELECT r.user_id,'comment_reacted',c.content_id,c.id,r.created_at FROM comment_reactions r JOIN comments c ON c.id=r.comment_id
) events ORDER BY created_at,kind,content_id,comment_id,actor_id;

CREATE FUNCTION record_content_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>'published' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN IF OLD.status='published' THEN RETURN NEW; END IF; END IF;
 INSERT INTO user_activities(actor_id,kind,content_id,created_at) VALUES(NEW.author_id,'content_published',NEW.id,COALESCE(NEW.published_at,now())) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER contents_activity AFTER INSERT OR UPDATE OF status ON contents FOR EACH ROW EXECUTE FUNCTION record_content_activity();

CREATE FUNCTION record_comment_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.author_id IS NOT NULL AND NEW.status<>'deleted' THEN
  INSERT INTO user_activities(actor_id,kind,content_id,comment_id,created_at) VALUES(NEW.author_id,'comment_created',NEW.content_id,NEW.id,NEW.created_at) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER comments_activity AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION record_comment_activity();

CREATE FUNCTION record_reaction_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source record; activity_kind text; target_content bigint; target_comment bigint;
BEGIN
 IF TG_OP='DELETE' THEN source:=OLD; ELSE source:=NEW; END IF;
 IF TG_TABLE_NAME='content_reactions' THEN activity_kind:='content_reacted';target_content:=source.content_id;target_comment:=NULL;
 ELSE activity_kind:='comment_reacted';target_comment:=source.comment_id;
  SELECT content_id INTO target_content FROM comments WHERE id=source.comment_id;
 END IF;
 IF TG_OP='DELETE' THEN
  -- Comment/content cascades can already have removed the parent or activity.
  IF target_comment IS NULL THEN
   UPDATE user_activities SET active=false WHERE actor_id=source.user_id AND kind=activity_kind AND content_id=target_content AND comment_id IS NULL AND active;
  ELSE
   UPDATE user_activities SET active=false WHERE actor_id=source.user_id AND kind=activity_kind AND comment_id=target_comment AND active;
  END IF;
  RETURN OLD;
 END IF;
 INSERT INTO user_activities(actor_id,kind,content_id,comment_id,created_at) VALUES(source.user_id,activity_kind,target_content,target_comment,source.created_at)
 ON CONFLICT(actor_id,kind,content_id,comment_id) DO UPDATE SET active=true WHERE NOT user_activities.active;
 RETURN NEW;
END $$;
CREATE TRIGGER content_reactions_activity AFTER INSERT OR UPDATE OF code OR DELETE ON content_reactions FOR EACH ROW EXECUTE FUNCTION record_reaction_activity();
CREATE TRIGGER comment_reactions_activity AFTER INSERT OR UPDATE OF code OR DELETE ON comment_reactions FOR EACH ROW EXECUTE FUNCTION record_reaction_activity();
