import {getPool} from "@sohoin/database";
import {cleanupMedia} from "./lib/media-cleanup";
const args=process.argv.slice(2);if(args.some(arg=>arg!=="--apply"&&!/^--(?:grace-hours|limit)=\d+$/.test(arg)))throw new Error("Use --apply, --grace-hours=48, --limit=1000");
const number=(name:string,fallback:number)=>Number(args.find(a=>a.startsWith(name+"="))?.split("=")[1]??fallback);
try{const report=await cleanupMedia({apply:args.includes("--apply"),graceHours:number("--grace-hours",48),limit:number("--limit",1000)});console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;}catch(error){console.error(error instanceof Error?error.message:"Media cleanup failed");process.exitCode=1;}finally{await getPool().end();}
