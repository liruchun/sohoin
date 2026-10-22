CREATE INDEX contents_achievement_author_idx ON contents(author_id,category_id,id)
 WHERE status='published' AND type IN ('post','article');
CREATE INDEX comments_achievement_author_idx ON comments(author_id,content_id,id)
 WHERE status='visible' AND NOT thread_hidden;
CREATE INDEX points_achievement_balance_idx ON points_entries(account_id,balance_after DESC)
 WHERE kind='credit';
