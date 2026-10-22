import {getPool} from "@sohoin/database";

// One-time cleanup of the display-name label previously added by the importer.
const hostname=new URL(process.env.DATABASE_URL!).hostname;
if(!["127.0.0.1","localhost"].includes(hostname))throw new Error("Only a local database is permitted");
const pool=getPool(),db=await pool.connect();
try{
 await db.query("BEGIN");
 await db.query("SET LOCAL lock_timeout='5s'");
 const label="（演示）";
 const updated=await db.query(`UPDATE "user" SET name=btrim(replace(name,$1,'')) WHERE strpos(name,$1)>0 AND btrim(replace(name,$1,''))<>''`,[label]);
 const remaining=await db.query(`SELECT count(*)::int AS count FROM "user" WHERE strpos(name,$1)>0`,[label]);
 if(remaining.rows[0].count)throw new Error("Some names would become empty; cleanup rolled back");
 await db.query("COMMIT");
 console.log(JSON.stringify({updated:updated.rowCount,remaining:remaining.rows[0].count}));
}catch(error){await db.query("ROLLBACK");throw error;}
finally{db.release();await pool.end();}
