import "server-only";
import {getPool} from "./index";
import {ADMIN_PERMISSIONS_LOCK} from "./advisory-locks";
export type ProfileRow={user_id:string;bio:string;homepage:string;version:number;data:Record<string,string|number|boolean>;schema_version:number};
export class ProfileStoreError extends Error{constructor(public code:"forbidden"|"missing"|"conflict"){super(code);}}
const projection=`u.id AS user_id,COALESCE(p.bio,'') AS bio,COALESCE(p.homepage,'') AS homepage,COALESCE(p.version,0) AS version,COALESCE(e.data,'{}'::jsonb) AS data,COALESCE(e.schema_version,0) AS schema_version`;
export async function readProfile(id:string,publicOnly=false){return (await getPool().query(`SELECT ${projection} FROM "user" u LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN user_extensions e ON e.user_id=u.id WHERE u.id=$1 AND (NOT $2::boolean OR NOT COALESCE(u.banned,false))`,[id,publicOnly])).rows[0] as ProfileRow|undefined;}
export async function writeProfile(actor:string,target:string,input:{version:number;bio:string;homepage:string},admin:boolean,extension?:{schemaVersion:number;data:Record<string,string|number|boolean>}){
 const client=await getPool().connect();try{await client.query("BEGIN");await client.query("SELECT pg_advisory_xact_lock_shared($1)",[ADMIN_PERMISSIONS_LOCK]);
 const users=(await client.query('SELECT id,role,COALESCE(banned,false) AS banned FROM "user" WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',[[actor,target]])).rows;
 const user=users.find(row=>row.id===actor);if(!user||user.banned||((actor!==target||admin)&&!user.role?.split(",").includes("admin")))throw new ProfileStoreError("forbidden");if(!users.some(row=>row.id===target))throw new ProfileStoreError("missing");
 await client.query("INSERT INTO user_profiles(user_id) VALUES($1) ON CONFLICT DO NOTHING",[target]);const old=(await client.query("SELECT bio,homepage,version FROM user_profiles WHERE user_id=$1 FOR UPDATE",[target])).rows[0];if(old.version!==input.version)throw new ProfileStoreError("conflict");
 const oldExtension=(await client.query("SELECT data,schema_version FROM user_extensions WHERE user_id=$1",[target])).rows[0];
 // Absent extension data preserves it, so editing bio cannot erase Custom data.
 if(extension){if(oldExtension&&oldExtension.schema_version!==extension.schemaVersion)throw new ProfileStoreError("conflict");await client.query("INSERT INTO user_extensions(user_id,schema_version,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(user_id) DO UPDATE SET schema_version=EXCLUDED.schema_version,data=EXCLUDED.data",[target,extension.schemaVersion,JSON.stringify(extension.data)]);}
 await client.query("UPDATE user_profiles SET bio=$2,homepage=$3,version=version+1,updated_at=now() WHERE user_id=$1",[target,input.bio,input.homepage]);
 const changed=[...(old.bio!==input.bio?["bio"]:[]),...(old.homepage!==input.homepage?["homepage"]:[]),...(extension&&JSON.stringify(oldExtension?.data??{})!==JSON.stringify(extension.data)?["data"]:[])];
 await client.query("INSERT INTO user_profile_audit(actor_id,target_id,changed_fields) VALUES($1,$2,$3)",[actor,target,changed]);
 const row=(await client.query(`SELECT ${projection} FROM "user" u JOIN user_profiles p ON p.user_id=u.id LEFT JOIN user_extensions e ON e.user_id=u.id WHERE u.id=$1`,[target])).rows[0] as ProfileRow;await client.query("COMMIT");return row;
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
