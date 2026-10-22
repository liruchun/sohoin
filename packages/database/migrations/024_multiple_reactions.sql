-- Preserve every existing selection; allow up to five distinct codes per target/user.
ALTER TABLE content_reactions DROP CONSTRAINT content_reactions_pkey;
ALTER TABLE content_reactions ADD PRIMARY KEY(content_id,user_id,code);
ALTER TABLE comment_reactions DROP CONSTRAINT comment_reactions_pkey;
ALTER TABLE comment_reactions ADD PRIMARY KEY(comment_id,user_id,code);

CREATE FUNCTION limit_reaction_selections() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target bigint; total integer;
BEGIN
 IF TG_TABLE_NAME='content_reactions' THEN target:=NEW.content_id; ELSE target:=NEW.comment_id; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||':'||target::text||':'||NEW.user_id,0));
 IF TG_TABLE_NAME='content_reactions' THEN
  SELECT count(*) INTO total FROM content_reactions WHERE content_id=target AND user_id=NEW.user_id AND code<>NEW.code;
 ELSE
  SELECT count(*) INTO total FROM comment_reactions WHERE comment_id=target AND user_id=NEW.user_id AND code<>NEW.code;
 END IF;
 IF total>=5 THEN RAISE EXCEPTION USING ERRCODE='23514',CONSTRAINT='reaction_selection_limit',MESSAGE='At most five reactions per user and target'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER content_reactions_limit BEFORE INSERT OR UPDATE ON content_reactions FOR EACH ROW EXECUTE FUNCTION limit_reaction_selections();
CREATE TRIGGER comment_reactions_limit BEFORE INSERT OR UPDATE ON comment_reactions FOR EACH ROW EXECUTE FUNCTION limit_reaction_selections();

CREATE OR REPLACE FUNCTION record_reaction_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source record; activity_kind text; target_content bigint; target_comment bigint; remaining boolean;
BEGIN
 IF TG_OP='DELETE' THEN source:=OLD; ELSE source:=NEW; END IF;
 IF TG_TABLE_NAME='content_reactions' THEN
  activity_kind:='content_reacted';target_content:=source.content_id;target_comment:=NULL;
 ELSE
  activity_kind:='comment_reacted';target_comment:=source.comment_id;
  SELECT content_id INTO target_content FROM comments WHERE id=source.comment_id;
 END IF;
 IF TG_OP='DELETE' THEN
  IF target_comment IS NULL THEN
   SELECT EXISTS(SELECT 1 FROM content_reactions WHERE content_id=target_content AND user_id=source.user_id) INTO remaining;
   UPDATE user_activities SET active=remaining WHERE actor_id=source.user_id AND kind=activity_kind AND content_id=target_content AND comment_id IS NULL AND active IS DISTINCT FROM remaining;
  ELSE
   SELECT EXISTS(SELECT 1 FROM comment_reactions WHERE comment_id=target_comment AND user_id=source.user_id) INTO remaining;
   UPDATE user_activities SET active=remaining WHERE actor_id=source.user_id AND kind=activity_kind AND comment_id=target_comment AND active IS DISTINCT FROM remaining;
  END IF;
  RETURN OLD;
 END IF;
 INSERT INTO user_activities(actor_id,kind,content_id,comment_id,created_at) VALUES(source.user_id,activity_kind,target_content,target_comment,source.created_at)
 ON CONFLICT(actor_id,kind,content_id,comment_id) DO UPDATE SET active=true WHERE NOT user_activities.active;
 RETURN NEW;
END $$;
