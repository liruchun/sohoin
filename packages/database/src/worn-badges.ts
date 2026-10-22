import "server-only";
import {getPool} from "./index";
import {BadgeStoreError} from "./badges";
type WornBadge={key:string;name:string;iconUrl:string|null};
type MedalItem=WornBadge&{description:string;awardedAt:string|null};

const iconJoin="LEFT JOIN media_assets m ON m.id=b.icon_media_id AND m.status='ready' AND m.kind='image' AND m.mime_type IN ('image/webp','image/svg+xml') AND m.storage_provider='local' AND m.storage_namespace='images-v1'";
const badgeJson="jsonb_build_object('key',b.key,'name',b.name,'iconUrl',CASE WHEN m.id IS NOT NULL THEN '/api/site-media/'||m.storage_key||CASE WHEN m.mime_type='image/svg+xml' THEN '' ELSE '?variant=thumbnail' END ELSE NULL END)";
// Check award revision as well as active state: a later re-award must not silently re-equip it.
const wornJoin=`JOIN user_badges a ON a.user_id=w.user_id AND a.badge_key=w.badge_key AND a.active AND a.revision=w.award_revision
 JOIN badges b ON b.key=a.badge_key AND b.enabled ${iconJoin}`;

export async function readWornBadges(userIds:string[]):Promise<Map<string,WornBadge>>{
 const ids=[...new Set(userIds)];
 if(ids.length>50)throw new Error("Worn badge batch exceeded");
 if(!ids.length)return new Map();
 const rows=await getPool().query(`SELECT w.user_id,${badgeJson} AS badge FROM user_worn_badges w ${wornJoin}
 JOIN "user" u ON u.id=w.user_id AND NOT COALESCE(u.banned,false) WHERE w.user_id=ANY($1::text[])`,[ids]);
 return new Map(rows.rows.map(row=>[row.user_id as string,row.badge as WornBadge]));
}

/** Public profile projection: active awards only, with no award/audit metadata. */
export async function readProfileBadges(userId:string):Promise<WornBadge[]>{
 const result=await getPool().query(`SELECT ${badgeJson} AS badge
 FROM user_badges a JOIN badges b ON b.key=a.badge_key AND b.enabled ${iconJoin}
 JOIN "user" u ON u.id=a.user_id AND NOT COALESCE(u.banned,false)
 WHERE a.user_id=$1 AND a.active ORDER BY a.awarded_at DESC,b.key LIMIT 30`,[userId]);
 return result.rows.map(row=>row.badge as WornBadge);
}

export async function readMedalCollection(userId:string,before?:string){
 const result=await getPool().query(`SELECT u.name,u.image,
 COALESCE((SELECT revision FROM user_worn_badges WHERE user_id=u.id),0) AS revision,
 (SELECT ${badgeJson} FROM user_worn_badges w ${wornJoin} WHERE w.user_id=u.id) AS worn,
 (SELECT count(*)::int FROM badges WHERE enabled) AS total,
 (SELECT count(*)::int FROM user_badges a JOIN badges b ON b.key=a.badge_key AND b.enabled WHERE a.user_id=u.id AND a.active) AS earned,
 COALESCE((SELECT jsonb_agg(page.item ORDER BY page.key) FROM (
  SELECT b.key,${badgeJson}||jsonb_build_object('description',b.description,'awardedAt',a.awarded_at) AS item
  FROM badges b ${iconJoin}
  LEFT JOIN user_badges a ON a.badge_key=b.key AND a.user_id=u.id AND a.active
  WHERE b.enabled AND ($2::text IS NULL OR b.key>$2) ORDER BY b.key LIMIT 31
 ) page),'[]'::jsonb) AS items
 FROM "user" u WHERE u.id=$1 AND NOT COALESCE(u.banned,false)`,[userId,before??null]);
 const row=result.rows[0] as {name:string;image:string|null;revision:number;worn:WornBadge|null;total:number;earned:number;items:MedalItem[]}|undefined;
 if(!row)throw new BadgeStoreError("forbidden");
 return row;
}

export async function writeWornBadge(userId:string,input:{badgeKey:string|null;revision:number}){
 const client=await getPool().connect();
 try{
  await client.query("BEGIN");
  // Same user -> badge -> award lock order as grants and revocations.
  const user=await client.query('SELECT 1 FROM "user" WHERE id=$1 AND NOT COALESCE(banned,false) FOR NO KEY UPDATE',[userId]);
  if(!user.rowCount)throw new BadgeStoreError("forbidden");
  const current=(await client.query("SELECT badge_key,revision FROM user_worn_badges WHERE user_id=$1 FOR UPDATE",[userId])).rows[0] as {badge_key:string|null;revision:number}|undefined;
  if((current?.revision??0)!==input.revision||input.revision>=2147483647)throw new BadgeStoreError("conflict");
  let awardRevision:number|null=null;
  if(input.badgeKey!==null){
   const badge=(await client.query("SELECT enabled FROM badges WHERE key=$1 FOR SHARE",[input.badgeKey])).rows[0];
   if(!badge)throw new BadgeStoreError("missing");
   if(!badge.enabled)throw new BadgeStoreError("disabled");
   const award=(await client.query("SELECT revision FROM user_badges WHERE user_id=$1 AND badge_key=$2 AND active FOR SHARE",[userId,input.badgeKey])).rows[0];
   if(!award)throw new BadgeStoreError("award_missing");
   awardRevision=award.revision;
  }
  const revision=input.revision+1;
  await client.query(`INSERT INTO user_worn_badges(user_id,badge_key,award_revision,revision) VALUES($1,$2,$3,$4)
   ON CONFLICT(user_id) DO UPDATE SET badge_key=EXCLUDED.badge_key,award_revision=EXCLUDED.award_revision,revision=EXCLUDED.revision`,[userId,input.badgeKey,awardRevision,revision]);
  await client.query("INSERT INTO worn_badge_audit(user_id,before_key,after_key,revision) VALUES($1,$2,$3,$4)",[userId,current?.badge_key??null,input.badgeKey,revision]);
  await client.query("COMMIT");
  return {badgeKey:input.badgeKey,revision};
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
