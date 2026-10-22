LOCK TABLE user_activities,user_follows IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 recipient_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 actor_id text REFERENCES "user"(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('reply','content_reacted','comment_reacted','follow','system')),
 activity_id bigint REFERENCES user_activities(id) ON DELETE CASCADE,
 system_key text,
 title text NOT NULL DEFAULT '' CHECK(length(title)<=120),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=1000),
 created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,
 CHECK(CASE WHEN kind='system' THEN activity_id IS NULL AND system_key IS NOT NULL AND length(system_key) BETWEEN 1 AND 64 AND length(btrim(title))>0 ELSE actor_id IS NOT NULL AND actor_id<>recipient_id AND system_key IS NULL AND title='' AND body='' AND ((kind='follow')=(activity_id IS NULL)) END),
 UNIQUE NULLS NOT DISTINCT(recipient_id,kind,actor_id,activity_id,system_key)
);
CREATE INDEX notifications_recipient_cursor_idx ON notifications(recipient_id,id DESC);
CREATE INDEX notifications_unread_cursor_idx ON notifications(recipient_id,id DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_actor_idx ON notifications(actor_id);
CREATE INDEX notifications_activity_idx ON notifications(activity_id) WHERE activity_id IS NOT NULL;
CREATE FUNCTION notify_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient text; notification_kind text;
BEGIN
 IF NEW.kind='comment_created' THEN
  SELECT CASE WHEN c.reply_to_id IS NULL THEN p.author_id ELSE t.author_id END INTO recipient FROM comments c JOIN contents p ON p.id=c.content_id LEFT JOIN comments t ON t.id=c.reply_to_id WHERE c.id=NEW.comment_id;
  notification_kind:='reply';
 ELSIF NEW.kind='content_reacted' THEN SELECT author_id INTO recipient FROM contents WHERE id=NEW.content_id;notification_kind:='content_reacted';
 ELSIF NEW.kind='comment_reacted' THEN SELECT author_id INTO recipient FROM comments WHERE id=NEW.comment_id;notification_kind:='comment_reacted';
 ELSE RETURN NEW;
 END IF;
 IF recipient IS NOT NULL AND recipient<>NEW.actor_id THEN
  INSERT INTO notifications(recipient_id,actor_id,kind,activity_id) VALUES(recipient,NEW.actor_id,notification_kind,NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER activities_notify AFTER INSERT ON user_activities FOR EACH ROW EXECUTE FUNCTION notify_activity();
CREATE FUNCTION notify_follow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO notifications(recipient_id,actor_id,kind) VALUES(NEW.following_id,NEW.follower_id,'follow') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER follows_notify AFTER INSERT ON user_follows FOR EACH ROW EXECUTE FUNCTION notify_follow();
