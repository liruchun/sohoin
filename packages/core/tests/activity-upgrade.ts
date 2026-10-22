import assert from "node:assert/strict";
import {randomBytes,createHash} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import {Pool,getPool} from "@sohoin/database";
export async function verifyActivityUpgrade(){
 const source=new URL(process.env.DATABASE_URL!);if(!/^\/sohoin_test_[a-f0-9]{16}$/.test(source.pathname))throw new Error("Upgrade fixture requires isolated runner");
 const name="sohoin_test_"+randomBytes(8).toString("hex"),url=new URL(source);url.pathname="/"+name;await getPool().query('CREATE DATABASE "'+name+'"');const pool=new Pool({connectionString:url.toString(),max:1});
 try{
  await pool.query("CREATE TABLE schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
  const directory=new URL("../../database/migrations/",import.meta.url);
  async function apply(name:string){const sql=await readFile(new URL(name,directory),"utf8");await pool.query("BEGIN");try{await pool.query(sql);await pool.query("INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",[name,createHash("sha256").update(sql).digest("hex")]);await pool.query("COMMIT");}catch(error){await pool.query("ROLLBACK");throw error;}}
  for(const file of (await readdir(directory)).filter(file=>/^\d+.*\.sql$/.test(file)&&Number(file.slice(0,3))<14).sort())await apply(file);
  await pool.query(`INSERT INTO "user"(id,name,email,"emailVerified") VALUES('upgrade-author','作者','upgrade-author@example.test',false),('upgrade-reactor','回应用户','upgrade-reactor@example.test',false)`);
  await pool.query("INSERT INTO content_categories(name,slug) VALUES('历史分类','upgrade-history')");
  await pool.query("INSERT INTO contents(type,title,body,category_id,status,author_id,published_at) VALUES('article','历史文章','正文',1,'archived','upgrade-author','2018-01-01Z')");
  await pool.query("INSERT INTO comments(content_id,author_id,body,created_at) VALUES(1,'upgrade-author','历史评论','2019-01-01Z')");
  await pool.query("INSERT INTO content_reactions(content_id,user_id,code,created_at) VALUES(1,'upgrade-reactor','like','2020-01-01Z')");
  await pool.query("INSERT INTO comment_reactions(comment_id,user_id,code,created_at) VALUES(1,'upgrade-reactor','love','2021-01-01Z')");
  await pool.query("INSERT INTO content_bookmarks(content_id,user_id) VALUES(1,'upgrade-reactor')");
  await apply("014_user_activities.sql");
  const rows=(await pool.query("SELECT id::text,kind,created_at FROM user_activities ORDER BY id")).rows;
  assert.deepEqual(rows.map(row=>row.kind),["content_published","comment_created","content_reacted","comment_reacted"]);assert.deepEqual(rows.map(row=>row.created_at.getUTCFullYear()),[2018,2019,2020,2021]);
  await pool.query("UPDATE contents SET status='published' WHERE id=1");assert.equal((await pool.query("SELECT count(*)::int AS n FROM user_activities")).rows[0].n,4);
  await pool.query("DELETE FROM content_reactions WHERE content_id=1");assert.equal((await pool.query("SELECT active FROM user_activities WHERE kind='content_reacted'")).rows[0].active,false);
  await pool.query("INSERT INTO content_reactions(content_id,user_id,code) VALUES(1,'upgrade-reactor','laugh')");const restored=(await pool.query("SELECT id::text,created_at FROM user_activities WHERE kind='content_reacted'")).rows[0];assert.equal(restored.id,rows[2].id);assert.equal(restored.created_at.getUTCFullYear(),2020);
 }finally{await pool.end();if(!/^sohoin_test_[a-f0-9]{16}$/.test(name)||name===source.pathname.slice(1))throw new Error("Unsafe upgrade fixture database");await getPool().query('DROP DATABASE "'+name+'" WITH (FORCE)');}
}
