import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {getPool,MIGRATION_LOCK,ADMIN_PERMISSIONS_LOCK} from "@sohoin/database";

type Item={id:string;author:string;body:string;createdAt:string;updatedAt:string;reactions:{code:string;count:number}[];media:string[];categories?:{key:string;plainText:string;description?:string}[];tags?:unknown[];postId?:string;parentId?:string|null;stats?:{reply_count?:number}};
type User={id:string;name:string;bio:string;avatar:string|null;homepage:string;links:string[];role:string};
export interface Dataset {source:string;capturedAt:string;posts:Item[];comments:Item[];users:User[];reactionTypes:{key:string;name:string;emoji:string;order:number}[];warnings:unknown[]}
function ensure(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}
const identifier=(v:unknown)=>typeof v==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(v);
const clean=(v:unknown,max:number)=>typeof v==="string"&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
function timestamp(v:string) {ensure(typeof v==="string"&&/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v),"Invalid source timestamp");const result=new Date(v.replace(" ","T")+"+08:00");ensure(Number.isFinite(result.getTime()),"Invalid timestamp");return result;}
export function validateDataset(data:Dataset) {
 ensure(data.source==="https://bonjour.bio/?feed=featured"&&Number.isFinite(Date.parse(data.capturedAt)),"Invalid source");
 ensure(Array.isArray(data.posts)&&data.posts.length===20&&Array.isArray(data.comments)&&data.comments.length<=3000&&Array.isArray(data.users)&&data.users.length<=1000,"Invalid dataset bounds");
 ensure(Array.isArray(data.reactionTypes)&&data.reactionTypes.length<=30,"Invalid reaction catalog");
 const users=new Set<string>(),posts=new Set<string>(),comments=new Map<string,Item>();
 for(const u of data.users){ensure(identifier(u.id)&&!users.has(u.id)&&clean(u.name,120)&&clean(u.bio,20000)&&clean(u.role,500),"Invalid or duplicate user");ensure(u.homepage==="https://bonjour.bio/"+u.id&&(u.avatar===null||/^https:\/\/cdn\.bonjour\.bio\//.test(u.avatar)),"Invalid profile URLs");ensure(Array.isArray(u.links)&&u.links.length<=12&&u.links.every(l=>clean(l,500)&&l.startsWith("https://")),"Invalid profile links");users.add(u.id);}
 const codes=new Set(["like"]);
 for(const t of data.reactionTypes){ensure(/^[a-z][a-z0-9_]{0,23}$/.test(t.key)&&clean(t.name,24)&&clean(t.emoji,16)&&Number.isInteger(t.order),"Invalid source reaction type");codes.add(t.key);}
 for(const p of [...data.posts,...data.comments]){
  ensure(identifier(p.id)&&users.has(p.author)&&clean(p.body,p.postId?5000:50000)&&p.body.trim().length>0,"Invalid content or author");timestamp(p.createdAt);timestamp(p.updatedAt);
  ensure(Array.isArray(p.reactions)&&p.reactions.length<=30&&new Set(p.reactions.map(r=>r.code)).size===p.reactions.length&&p.reactions.every(r=>codes.has(r.code)&&Number.isInteger(r.count)&&r.count>0&&r.count<=1000000),"Invalid reaction totals");
 }
 for(const p of data.posts){ensure(!posts.has(p.id),"Duplicate post");posts.add(p.id);ensure((p.categories??[]).length<=10&&(p.categories??[]).every(c=>clean(c.key,100)&&clean(c.plainText,60)&&clean(c.description??"",300)),"Invalid categories");}
 for(const c of data.comments){ensure(!comments.has(c.id)&&posts.has(c.postId!),"Duplicate comment or missing post");comments.set(c.id,c);}
 // Validate all parent chains before touching the database; secondary replies retain their actual target.
 for(const c of data.comments){const seen=new Set([c.id]);let node=c;while(node.parentId){const parent=comments.get(node.parentId);ensure(parent&&parent.postId===c.postId&&!seen.has(parent.id),"Missing, cyclic or cross-post reply target");seen.add(parent.id);node=parent;}}
 return data;
}
export async function importBonjour(data:Dataset,batch:string,datasetHash:string) {
 validateDataset(data);ensure(/^[a-z0-9-]{1,100}$/.test(batch)&&/^[a-f0-9]{64}$/.test(datasetHash),"Invalid import identity");
 const url=new URL(process.env.DATABASE_URL!);ensure(["127.0.0.1","localhost"].includes(url.hostname),"Demo import only permits a local database");
 const db=await getPool().connect(),prefix=createHash("sha256").update(batch).digest("hex").slice(0,10),uid=(slug:string)=>"demo_bonjour_"+prefix+"_"+slug;
 try {
  await db.query("BEGIN");await db.query("SET LOCAL lock_timeout='10s'");await db.query("SELECT pg_advisory_xact_lock_shared($1)",[MIGRATION_LOCK]);await db.query("SELECT pg_advisory_xact_lock_shared($1)",[ADMIN_PERMISSIONS_LOCK]);await db.query("SELECT pg_advisory_xact_lock(82405624)");
  const old=(await db.query("SELECT dataset_hash,summary FROM demo_imports WHERE id=$1",[batch])).rows[0];
  if(old){ensure(old.dataset_hash===datasetHash,"Batch exists with different source data; refusing to overwrite");await db.query("COMMIT");return {...old.summary,alreadyImported:true};}
  await db.query("INSERT INTO demo_imports(id,source_url,captured_at,dataset_hash) VALUES($1,$2,$3,$4)",[batch,data.source,data.capturedAt,datasetHash]);
  async function record(kind:string,source:string,local:string,snapshot:unknown,url:string){await db.query("INSERT INTO demo_import_objects(batch_id,kind,source_id,local_id,source_url,snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb)",[batch,kind,source,local,url,JSON.stringify(snapshot)]);}
  let shortenedBios=0;
  for(const u of data.users){const id=uid(u.id);await db.query(`INSERT INTO "user"(id,name,email,"emailVerified",image,role,banned) VALUES($1,$2,$3,false,$4,'user',false)`,[id,u.name,id+"@example.invalid",u.avatar]);if([...u.bio].length>500)shortenedBios++;
   await db.query("INSERT INTO user_profiles(user_id,bio,homepage) VALUES($1,$2,$3)",[id,[...u.bio].slice(0,500).join(""),u.homepage]);
   await db.query("INSERT INTO user_extensions(user_id,schema_version,data) VALUES($1,1,$2::jsonb)",[id,JSON.stringify({demoSource:"bonjour",sourceProfile:u.homepage,role:u.role,links:JSON.stringify(u.links)})]);await record("user",u.id,id,u,u.homepage);
  }
  for(const t of data.reactionTypes){const existing=(await db.query("SELECT emoji FROM reaction_types WHERE code=$1",[t.key])).rows[0];if(existing)ensure(existing.emoji===t.emoji,"Reaction code already used by a different emoji: "+t.key);else await db.query("INSERT INTO reaction_types(code,label,emoji,position) VALUES($1,$2,$3,$4)",[t.key,t.name,t.emoji,Math.min(t.order,100)]);}
  const categories=new Map<string,string>(),postIds=new Map<string,string>(),commentIds=new Map<string,string>();
  for(const p of data.posts){const category=p.categories?.[0]??{key:"uncategorized",plainText:"未分类",description:""};let categoryId=categories.get(category.key);
   if(!categoryId){const slug="demo-bonjour-"+prefix+"-"+createHash("sha256").update(category.key).digest("hex").slice(0,12);categoryId=(await db.query("INSERT INTO content_categories(name,slug,description) VALUES($1,$2,$3) RETURNING id::text",[category.plainText,slug,category.description??""])).rows[0].id;categories.set(category.key,categoryId!);await record("category",category.key,categoryId!,category,data.source);}
   const id=(await db.query("INSERT INTO contents(type,title,body,category_id,status,author_id,created_at,updated_at,published_at,featured,featured_at) VALUES('post','',$1,$2,'published',$3,$4,$5,$4,true,$4) RETURNING id::text",[p.body,categoryId,uid(p.author),timestamp(p.createdAt),timestamp(p.updatedAt)])).rows[0].id;postIds.set(p.id,id);await record("content",p.id,id,p,"https://bonjour.bio/posts/"+p.id);
  }
  const pending=new Map(data.comments.map(c=>[c.id,c])),byId=new Map(data.comments.map(c=>[c.id,c]));
  while(pending.size){let inserted=0;for(const [source,c] of pending){if(c.parentId&&!commentIds.has(c.parentId))continue;let root:string|null=null,reply:string|null=null;
    if(c.parentId){reply=commentIds.get(c.parentId)!;let parent=byId.get(c.parentId)!;while(parent.parentId)parent=byId.get(parent.parentId)!;root=commentIds.get(parent.id)!;}
    const id=(await db.query("INSERT INTO comments(content_id,author_id,root_id,reply_to_id,body,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text",[postIds.get(c.postId!),uid(c.author),root,reply,c.body,timestamp(c.createdAt),timestamp(c.updatedAt)])).rows[0].id;commentIds.set(source,id);await record("comment",source,id,c,"https://bonjour.bio/posts/"+c.postId);pending.delete(source);inserted++;
   }ensure(inserted>0,"Unresolved reply dependency");}
  let reactionRows=0,postReactions=0,commentReactions=0;
  for(const [items,ids,kind] of [[data.posts,postIds,"content"],[data.comments,commentIds,"comment"]] as const)for(const item of items)for(const r of item.reactions){await db.query("INSERT INTO demo_reaction_counts(batch_id,content_id,comment_id,code,count) VALUES($1,$2,$3,$4,$5)",[batch,kind==="content"?ids.get(item.id):null,kind==="comment"?ids.get(item.id):null,r.code,r.count]);reactionRows++;if(kind==="content")postReactions+=r.count;else commentReactions+=r.count;}
  // Automatic source triggers remain enabled; suppress only notifications to this new demo cohort.
  await db.query("DELETE FROM notifications WHERE recipient_id=ANY($1::text[])",[data.users.map(u=>uid(u.id))]);
  const summary={batch,posts:postIds.size,comments:commentIds.size,users:data.users.length,categories:categories.size,postReactions,commentReactions,reactionRows,shortenedBios,sourceWarnings:data.warnings.length};
  await db.query("UPDATE demo_imports SET summary=$2::jsonb WHERE id=$1",[batch,JSON.stringify(summary)]);await db.query("COMMIT");return {...summary,alreadyImported:false};
 } catch(error){await db.query("ROLLBACK");throw error;}finally{db.release();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const [file,batch]=process.argv.slice(2);ensure(file&&batch,"Usage: import-bonjour.ts <dataset.json> <batch-id>");const raw=await readFile(file);ensure(raw.length<=16*1024*1024,"Dataset too large");console.log(JSON.stringify(await importBonjour(JSON.parse(raw.toString("utf8")),batch,createHash("sha256").update(raw).digest("hex")),null,2));}
 finally{await getPool().end();}
}
