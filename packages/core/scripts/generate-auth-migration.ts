import {getMigrations} from "better-auth/db/migration";
import {getAuth} from "../src/server/auth";
import {getPool} from "@sohoin/database";
import {writeFile} from "node:fs/promises";
try {const plan=await getMigrations(getAuth().options);const sql=await plan.compileMigrations();if(!sql.trim())throw new Error("No pending auth schema changes");await writeFile(new URL("../../database/migrations/002_auth.sql",import.meta.url),"-- Generated from pinned Better Auth 1.7.9 options; reviewed before application.\n"+sql+"\n");console.log("Generated auth SQL migration");}finally{await getPool().end();}
