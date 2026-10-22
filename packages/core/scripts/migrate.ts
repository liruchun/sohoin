import {readFile,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {getPool,MIGRATION_LOCK} from "@sohoin/database";
const client=await getPool().connect();
try {
 await client.query("SELECT pg_advisory_lock($1)",[MIGRATION_LOCK]);
 await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT NOW())");
 const directory=new URL("../../database/migrations/",import.meta.url);
 for(const name of (await readdir(directory)).filter(x=>x.endsWith(".sql")).sort()){
   const sql=await readFile(new URL(name,directory),"utf8");const checksum=createHash("sha256").update(sql).digest("hex");
   const existing=await client.query("SELECT checksum FROM schema_migrations WHERE name=$1",[name]);
   if(existing.rows.length){if(existing.rows[0].checksum!==checksum)throw new Error("Applied migration changed: "+name);continue;}
   await client.query("BEGIN");try{await client.query(sql);await client.query("INSERT INTO schema_migrations (name,checksum) VALUES ($1,$2)",[name,checksum]);await client.query("COMMIT");}catch(error){await client.query("ROLLBACK");throw error;}
   console.log("Applied "+name);
 }
 await client.query("DELETE FROM request_limits WHERE expires_at < NOW() - INTERVAL '1 day'");
} finally {await client.query("SELECT pg_advisory_unlock($1)",[MIGRATION_LOCK]);client.release();await getPool().end();}
