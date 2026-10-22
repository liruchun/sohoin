import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {getPool,writeBadgeDefinition,persistSettings,writeTerm} from "@sohoin/database";
import {createBadgeSchema} from "@sohoin/extension-api/badges";
import {storeMediaUpload} from "../src/server/media";
import {achievementRules} from "../src/server/achievements";

// Explicit local content import. Existing definitions require --update-existing; grants are preserved.
const pool=getPool();
try{
 if(!["127.0.0.1","localhost"].includes(new URL(process.env.DATABASE_URL!).hostname))throw new Error("This content import is limited to the local database");
 const actor=(await pool.query(`SELECT id FROM "user" WHERE NOT COALESCE(banned,false)
  AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),',')) ORDER BY id LIMIT 1`)).rows[0]?.id as string|undefined;
 if(!actor)throw new Error("An active administrator is required");
 const base=new URL("../assets/badges/",import.meta.url);
 const catalog=JSON.parse(await readFile(new URL("catalog.json",base),"utf8")) as {key:string;name:string;description:string;file:string}[];
 if(catalog.length!==achievementRules.length||new Set(catalog.map(item=>item.key)).size!==catalog.length||achievementRules.some(rule=>!catalog.some(item=>item.key===rule.key)))throw new Error("Unexpected badge catalog");
 const updateExisting=process.argv.includes("--update-existing");
 for(const [slug,name,description] of [["tips","干货","分享亲测有效的方法与经验"],["gear","秀装备","分享正在使用的工具与装备"],["products","产品","介绍你自己做的产品"]]){
  if(!(await pool.query("SELECT 1 FROM content_categories WHERE slug=$1",[slug])).rowCount){await writeTerm(actor,"categories",{slug,name,description});console.log("Created category:",name);}
 }
 let created=0;
 for(const item of catalog){
  if(!/^soho-[a-z-]+\.svg$/.test(item.file))throw new Error("Invalid local asset path");
  const definition=createBadgeSchema.parse({key:item.key,name:item.name,description:item.description,enabled:true,reason:"按用户确认的 SOHO 定位导入原创 SVG 勋章"});
  const current=(await pool.query("SELECT name,description,enabled,revision,icon_media_id::text FROM badges WHERE key=$1",[definition.key])).rows[0];
  if(current&&!updateExisting){console.log("Kept existing badge:",definition.name);continue;}
  const bytes=await readFile(new URL(item.file,base));
  const fileName=item.key+"-"+createHash("sha256").update(bytes).digest("hex").slice(0,16)+".svg";
  let icon=(await pool.query("SELECT id::text FROM media_assets WHERE original_name=$1 AND mime_type='image/svg+xml' AND status='ready' AND storage_provider='local' AND storage_namespace='images-v1' ORDER BY id LIMIT 1",[fileName])).rows[0] as {id:string}|undefined;
  if(!icon)icon=await storeMediaUpload(actor,{name:fileName,mime:"image/svg+xml",purpose:"badge",read:async()=>bytes});
  if(current&&current.name===definition.name&&current.description===definition.description&&current.icon_media_id===icon.id)continue;
  await writeBadgeDefinition({kind:"admin",id:actor},{...definition,enabled:current?.enabled??true,revision:current?.revision,iconMediaId:icon.id});
  console.log(current?"Updated badge:":"Created badge:",definition.name);created++;
 }
 if(updateExisting)for(const key of ["soho-site-launch","soho-global-explorer","soho-workflow-alchemist","soho-long-game"]){
  const old=(await pool.query("SELECT name,description,enabled,revision FROM badges WHERE key=$1",[key])).rows[0];
  if(old?.enabled){await writeBadgeDefinition({kind:"admin",id:actor},{key,...old,enabled:false,reason:"按确认的社区成就方案停用旧行业勋章，保留历史授予"});console.log("Retired badge:",old.name);}
 }
 // Correct the former positioning only if the persisted description is the old default.
 const settings=(await pool.query("SELECT value->>'description' AS description,revision FROM site_settings WHERE id=1")).rows[0];
 const old="面向做独立站的朋友的轻社交社区，分享建站经验、交流想法，认识同行。";
 if(settings?.description===old){
  const result=await persistSettings({description:"soho人的生存指南。面向超级个体、独立开发者、独立站从业者、外贸人等，分享经验、交流想法，认识同行。"},settings.revision,actor);
  if(!result)throw new Error("Site description changed during import; retry separately");
  console.log("Updated the former default site description");
 }
 console.log(`Imported ${created} badges; no user awards were changed.`);
}finally{await pool.end();}
