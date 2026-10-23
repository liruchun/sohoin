import "server-only";
export {readMemberDetails,readMemberContacts,writeMemberDetails} from './member-profiles';
export {readMemberMedia,readMemberMediaFile,insertMemberMedia,readVisibleMemberMedia,MemberMediaFullError,type MemberMediaRow} from "./member-media";
export {reconcileAchievements,type AchievementMetrics} from "./achievements";
export {readProfileBadges,readWornBadges,readMedalCollection,writeWornBadge} from "./worn-badges";
export {readBadgeDefinition,readBadgeOptions,readBadgeRecipients,readUserBadgeDetails} from "./badges";
export {writeBadgeDefinition,writeUserBadge,readBadgeDefinitions,readUserBadges,readManagedUserBadges,readBadgeAudit,BadgeStoreError,type BadgeActor} from "./badges";
export {runPointsTransaction,checkPointsActor,writePoints,readPointsBalance,readPointsEntries,PointsStoreError,type PointsClient,type PointsRow} from "./points";
export {readSiteAncestorReplyCounts,readSiteContentHead,readSiteCommentRoots,readSiteCommentReplies,readPublicCommentIds,savePublicCommentIds,readSiteSelectedComment,readSiteDirectReplies,readSiteDescendantReplies,readSiteCommentParent,type PublicCommentRow} from "./public-discussion";
export {readProfile,writeProfile,ProfileStoreError,type ProfileRow} from "./profiles";
export {readNotifications,unreadNotificationCount,markNotificationsRead,sendSystemNotification,NotificationStoreError,type NotificationRow} from "./notifications";
export {readFollowingActivities,type ActivityRow} from "./activities";
export {writeFollow,readFollowStates,readOwnFollows,FollowStoreError,type FollowStateRow,type FollowListRow} from "./follows";
export {readReactionTypes,updateStoredReactionType,writeInteraction,readInteractionBatch,readOwnBookmarks,InteractionStoreError} from "./interactions";
export {readComments,readComment,moderateStoredComment,readCommentAudit,CommentStoreError,type CommentRow} from "./comments";
export {MIGRATION_LOCK,ADMIN_PERMISSIONS_LOCK} from "./advisory-locks";
export {acquireMediaStorageLock,MediaMaintenanceBusyError,MEDIA_STORAGE_LOCK} from "./media-maintenance-lock";
export {MediaStoreError,readMediaList,readMediaFile,readSiteLogoFile,readSiteIconFile,readMediaReferences,readMediaAudit,insertMedia,tombstoneMedia,type MediaRow} from "./media";
export {readManagedUsers,readManagedUser,persistManagedUser,type UserRecord} from "./users";
export {readOwnSessions,revokeOwnSessions,readUserAudit,readAccountAudit} from "./account";
export {ContentStoreError,readTerms,readTerm,writeTerm,deleteTerm,readContentList,readContent,writeContent,deleteContent,readContentAudit,type ContentRow} from "./content";
import { Pool } from "pg";
export {Pool};
const globalDb = globalThis as unknown as {sohoinPool?: Pool};
export function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  return globalDb.sohoinPool ??= new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
}
export async function readSettingsRecord() {
  const result = await getPool().query("SELECT value, revision FROM site_settings WHERE id = 1");
  if (!result.rows[0]) throw new Error("Site settings migration is missing");
  return result.rows[0] as {value:unknown;revision:number};
}
export class SettingsLogoError extends Error {}
export class SettingsIconError extends SettingsLogoError {}
export async function persistSettings(patch: unknown, revision: number, actorId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT value, revision FROM site_settings WHERE id = 1 FOR UPDATE");
    if (current.rows[0].revision !== revision) { await client.query("ROLLBACK"); return null; }
    const before = current.rows[0].value;
    const next = {...before,...patch as object,custom:{...before.custom,...(patch as {custom?:object}).custom}};
    const logoIds=[...new Set([next.logo?.normal,next.logo?.dark,next.icons?.favicon,next.icons?.app].filter((id):id is string=>typeof id==="string"))];
    if(logoIds.length){
      // Lock in ID order so logo changes and media deletion cannot race.
      const assets=await client.query("SELECT id FROM media_assets WHERE id=ANY($1::bigint[]) AND status='ready' AND kind='image' ORDER BY id FOR SHARE",[logoIds]);
      if(assets.rowCount!==logoIds.length)throw new SettingsLogoError("Logo 或图标图片不存在或已删除，请重新选择");
    }
    const iconIds=[...new Set([next.icons?.favicon,next.icons?.app].filter((id):id is string=>typeof id==="string"))];
    if(iconIds.length){
      const variants=await client.query("SELECT media_id::text,variant_key FROM media_variants WHERE media_id=ANY($1::bigint[]) AND status='ready' AND mime_type='image/png'",[iconIds]);
      const ready=new Set(variants.rows.map(row=>row.media_id+":"+row.variant_key));
      if(next.icons?.favicon&&!ready.has(next.icons.favicon+":favicon"))throw new SettingsIconError("请先生成 favicon，再保存设置");
      if(next.icons?.app&&!["apple","app-192","app-512","maskable-512"].every(key=>ready.has(next.icons.app+":"+key)))throw new SettingsIconError("请先生成完整的 App 图标，再保存设置");
    }
    const result = await client.query("UPDATE site_settings SET value = $1::jsonb, revision = revision + 1, updated_at = NOW() WHERE id = 1 RETURNING value, revision", [JSON.stringify(next)]);
    await client.query("INSERT INTO settings_audit (actor_id, before_value, after_value) VALUES ($1,$2::jsonb,$3::jsonb)",[actorId,JSON.stringify(before),JSON.stringify(next)]);
    await client.query("COMMIT");
    return result.rows[0] as {value:unknown;revision:number};
  } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
/** Atomic shared counters: no per-process memory bypass. */
export async function consumeLimit(key: string, windowSeconds: number, max: number) {
  const result = await getPool().query(
    "INSERT INTO request_limits (key, count, expires_at) VALUES ($1,1,NOW() + $2 * INTERVAL '1 second') ON CONFLICT (key) DO UPDATE SET count = CASE WHEN request_limits.expires_at <= NOW() THEN 1 ELSE request_limits.count + 1 END, expires_at = CASE WHEN request_limits.expires_at <= NOW() THEN EXCLUDED.expires_at ELSE request_limits.expires_at END RETURNING count, GREATEST(1,CEIL(EXTRACT(EPOCH FROM (expires_at - NOW()))))::int AS retry", [key,windowSeconds]);
  return {allowed:result.rows[0].count <= max,retryAfter:result.rows[0].retry as number};
}

/** One bounded query, keyset pagination and no count(*) or per-row queries. */
export async function readSettingsAudit(before?:string) {
 const result=await getPool().query(
  'SELECT a.id::text AS id, u.name AS actor_name, u.email AS actor_email, a.created_at, ARRAY(SELECT key FROM jsonb_object_keys(a.before_value || a.after_value) AS key WHERE a.before_value -> key IS DISTINCT FROM a.after_value -> key) AS changed_fields FROM settings_audit a LEFT JOIN "user" u ON u.id = a.actor_id WHERE ($1::bigint IS NULL OR a.id < $1::bigint) ORDER BY a.id DESC LIMIT 31',
  [before??null]);
 return result.rows as {id:string;actor_name:string|null;actor_email:string|null;created_at:Date;changed_fields:string[]}[];
}

export {readSiteFeed,readSiteContent,readSiteProfile,readPublicRouteTarget,readPublicRouteIds,savePublicRouteIds,readSiteSitemap,readSiteTopics,readSiteTopic,readSiteCommunityFeed,readSiteCategoryMembership,writeSiteCategoryMembership,type PublicFeedRow,type SiteTopicRow,type SiteTopicRef,type CommunitySort} from "./public-site";
export {readSiteInteractionTargets,readSiteCommentTarget} from "./public-interactions";
export {createMemberPublication,readPublishingCategories,readOwnPublication,changeOwnPublication,PublishingStoreError} from './member-publishing';
export {MEMBER_MEDIA_PAGE_SIZE,readMemberMediaPage,readMemberMediaById} from './member-media';
export {searchMentionMembers,readMentionMembers} from './member-mentions';
export {readSitePresentation,readCommentPresentation,readPublicMediaFile,type SitePresentation} from "./public-media";
export {readResponsiveMediaBatch,addResponsiveMedia} from "./media";
