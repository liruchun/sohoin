import {Pool} from "pg";
import {spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import path from "node:path";
import {mkdir,rm} from "node:fs/promises";
const url=new URL(process.env.DATABASE_URL!);
const mode=process.argv[2]??"security";if(!["security","maintenance","performance","activities-performance","community-performance","demo-import","public-site"].includes(mode))throw new Error("Unknown test suite");
if(!["127.0.0.1","localhost"].includes(url.hostname))throw new Error("Security integration tests require a local PostgreSQL server");
const database="sohoin_test_"+randomBytes(8).toString("hex");
const mediaBase=path.resolve(import.meta.dirname,"../../../.local/security-media");
const mediaDir=path.join(mediaBase,database);
const pool=new Pool({connectionString:url.toString()});
async function run(args:string[]){const child=spawn(process.execPath,args,{stdio:"inherit",windowsHide:true,env:{...process.env,DATABASE_URL:url.toString(),MEDIA_STORAGE_DIR:mediaDir}});const code=await new Promise<number|null>(resolve=>child.once("exit",resolve));if(code!==0)throw new Error("Security test command failed");}
try{
 await mkdir(mediaDir,{recursive:true});
 await pool.query('CREATE DATABASE "'+database+'"');
 url.pathname="/"+database;
 await run(["--conditions=react-server","--import=tsx","packages/core/scripts/migrate.ts"]);
 await run(["--conditions=react-server","--import=tsx","--test",`packages/core/tests/${mode}.test.ts`]);
}finally{
 if(!/^sohoin_test_[a-f0-9]{16}$/.test(database))throw new Error("Unexpected test database name");
 await pool.query('DROP DATABASE IF EXISTS "'+database+'" WITH (FORCE)');await pool.end();
 if(path.dirname(path.resolve(mediaDir))!==mediaBase||path.basename(mediaDir)!==database)throw new Error("Unexpected media test path");
 await rm(mediaDir,{recursive:true,force:true});
}
