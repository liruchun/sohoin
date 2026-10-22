import "server-only";
import {getPool} from "./index";

export type AchievementMetrics={avatar:boolean;posts:number;tips:number;gear:number;products:number;replies:number;likesGiven:number;likesReceived:number;seedMilestone:boolean;discussion:boolean};
// All counts stop at the highest milestone. Imported and inaccessible content never contributes.
const realPost=`c.status='published' AND c.type IN ('post','article')
 AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='content' AND d.local_id=c.id::text)
 AND EXISTS(SELECT 1 FROM "user" owner WHERE owner.id=c.author_id AND NOT COALESCE(owner.banned,false)
  AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='user' AND d.local_id=owner.id))`;
const realReply=`a.status='visible' AND NOT a.thread_hidden
 AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='comment' AND d.local_id=a.id::text)
 AND EXISTS(SELECT 1 FROM "user" speaker WHERE speaker.id=a.author_id AND NOT COALESCE(speaker.banned,false)
  AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='user' AND d.local_id=speaker.id))
 AND (a.root_id IS NULL OR EXISTS(SELECT 1 FROM comments root JOIN "user" ru ON ru.id=root.author_id
  WHERE root.id=a.root_id AND root.status='visible' AND NOT root.thread_hidden AND NOT COALESCE(ru.banned,false)
  AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE (d.kind='comment' AND d.local_id=root.id::text) OR (d.kind='user' AND d.local_id=ru.id))))`;
const countPosts=(slug:string|null,limit:number)=>`(SELECT count(*)::int FROM (SELECT 1 FROM contents c ${slug?"JOIN content_categories category ON category.id=c.category_id":""}
 WHERE c.author_id=u.id AND ${realPost} ${slug?`AND category.slug='${slug}'`:""} LIMIT ${limit}) matched)`;

/** Core owns eligibility; this storage transaction supplies a consistent snapshot and durable one-time awards. */
export async function reconcileAchievements(userId:string,keys:readonly string[],eligible:(metrics:AchievementMetrics)=>readonly string[]){
 if(keys.length>20)throw new Error("Achievement catalog exceeded");
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  const user=await client.query(`SELECT 1 FROM "user" u WHERE u.id=$1 AND NOT COALESCE(u.banned,false)
   AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='user' AND d.local_id=u.id) FOR NO KEY UPDATE`,[userId]);
  if(!user.rowCount){await client.query("COMMIT");return [];}
  const available=await client.query(`SELECT b.key FROM badges b WHERE b.key=ANY($2::text[]) AND b.enabled
   AND NOT EXISTS(SELECT 1 FROM user_badges a WHERE a.user_id=$1 AND a.badge_key=b.key) ORDER BY b.key FOR SHARE`,[userId,keys]);
  // A manually revoked award is deliberately not restored by the automatic checker.
  if(!available.rowCount){await client.query("COMMIT");return [];}
  const row=(await client.query(`SELECT
   EXISTS(SELECT 1 FROM media_assets m WHERE m.uploader_id=u.id AND m.status='ready' AND m.kind='image'
    AND m.mime_type='image/webp' AND m.storage_provider='local' AND m.storage_namespace='images-v1'
    AND u.image='/api/site-media/'||m.storage_key) AS avatar,
   ${countPosts(null,20)} AS posts,${countPosts("tips",5)} AS tips,${countPosts("gear",3)} AS gear,${countPosts("products",1)} AS products,
   (SELECT count(*)::int FROM (SELECT 1 FROM comments a JOIN contents c ON c.id=a.content_id
    WHERE a.author_id=u.id AND c.author_id<>u.id AND ${realPost} AND ${realReply} LIMIT 50) matched) AS replies,
   (SELECT count(*)::int FROM (SELECT 1 FROM content_reactions r JOIN contents c ON c.id=r.content_id
    WHERE r.user_id=u.id AND r.code='like' AND c.author_id<>u.id AND ${realPost} LIMIT 100) matched) AS "likesGiven",
   (SELECT count(*)::int FROM (SELECT 1 FROM contents c JOIN content_reactions r ON r.content_id=c.id
    JOIN "user" voter ON voter.id=r.user_id AND NOT COALESCE(voter.banned,false)
    WHERE c.author_id=u.id AND r.user_id<>u.id AND r.code='like' AND ${realPost}
    AND NOT EXISTS(SELECT 1 FROM demo_import_objects d WHERE d.kind='user' AND d.local_id=voter.id) LIMIT 100) matched) AS "likesReceived",
   (EXISTS(SELECT 1 FROM points_accounts p WHERE p.user_id=u.id AND p.balance>=1000)
    OR EXISTS(SELECT 1 FROM points_entries p WHERE p.account_id=u.id AND p.kind='credit' AND p.balance_after>=1000
     AND NOT EXISTS(SELECT 1 FROM points_entries correction WHERE correction.reversal_of=p.id))) AS "seedMilestone",
   EXISTS(SELECT 1 FROM contents c WHERE c.author_id=u.id AND ${realPost}
    AND (SELECT count(*) FROM (SELECT 1 FROM comments a WHERE a.content_id=c.id AND a.author_id<>u.id AND ${realReply} LIMIT 30) replies)>=30
    AND (SELECT count(*) FROM (SELECT DISTINCT a.author_id FROM comments a WHERE a.content_id=c.id AND a.author_id<>u.id AND ${realReply} LIMIT 10) speakers)>=10) AS discussion
   FROM "user" u WHERE u.id=$1`,[userId])).rows[0] as AchievementMetrics;
  const wanted=new Set(eligible(row));
  const awarded:string[]=[];
  for(const {key} of available.rows as {key:string}[]){
   if(!wanted.has(key))continue;
   const result=await client.query(`INSERT INTO user_badges(user_id,badge_key,active,awarded_at) VALUES($1,$2,true,clock_timestamp())
    ON CONFLICT(user_id,badge_key) DO NOTHING RETURNING revision,awarded_at`,[userId,key]);
   if(!result.rowCount)continue;
   const state={userId,badgeKey:key,active:true,revision:result.rows[0].revision,awardedAt:result.rows[0].awarded_at.toISOString(),revokedAt:null};
   await client.query(`INSERT INTO badge_audit(badge_key,user_id,operation,actor_kind,actor_id,reason,idempotency_key,request,before_value,after_value,changed)
    VALUES($1,$2,'grant','system','soho-achievements','达到社区成就条件',$3,$4::jsonb,NULL,$5::jsonb,true)`,
    [key,userId,"achievement:v1:"+key,JSON.stringify({sourceType:"achievement",sourceId:key,metrics:row}),JSON.stringify(state)]);
   awarded.push(key);
  }
  await client.query("COMMIT");return awarded;
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
