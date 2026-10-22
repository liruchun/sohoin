import {randomBytes} from "node:crypto";
import {getPool,acquireMediaStorageLock,readResponsiveMediaBatch,addResponsiveMedia} from "@sohoin/database";
import {buildResponsiveImages} from "../src/server/media-responsive";
import {loadMediaBytes,saveMediaBytes,removeMediaBytes} from "../src/server/media-storage";

const args=process.argv.slice(2);
if(args.some(arg=>arg!=="--apply"&&!/^--limit=\d+$/.test(arg)&&!/^--email=.+$/.test(arg)))throw new Error("Use --apply --email=administrator@example.com --limit=100");
const apply=args.includes("--apply"),limit=Number(args.find(a=>a.startsWith("--limit="))?.slice(8)??100);
const email=args.find(a=>a.startsWith("--email="))?.slice(8);
let release:(()=>Promise<void>)|undefined;
try{
 const rows=await readResponsiveMediaBatch(limit);
 if(!apply){console.log(JSON.stringify({dryRun:true,pendingInBatch:rows.length,limit,note:"Repeat with --apply --email=<administrator email> to generate; repeat batches until pendingInBatch is zero."}));}
 else{
  if(!email)throw new Error("--email is required for authorized audit records");
  const actor=(await getPool().query(`SELECT id FROM "user" WHERE email=$1 AND NOT COALESCE(banned,false) AND 'admin'=ANY(string_to_array(COALESCE(role,'user'),','))`,[email])).rows[0];
  if(!actor)throw new Error("Active administrator not found");
  release=await acquireMediaStorageLock(true);
  let generated=0;
  for(const row of rows){
   const written:{namespace:string;key:string}[]=[];
   try{
    generated+=await addResponsiveMedia(actor.id,row.id,async(asset,existing)=>{
     const bytes=await loadMediaBytes(asset.storage_namespace,asset.storage_key,Number(asset.byte_size));
     const images=await buildResponsiveImages(bytes,asset.width,existing);
     const variants=[];
     for(const image of images){
      const key=asset.storage_key.slice(0,8)+randomBytes(16).toString("hex")+"-"+image.variant+".webp";
      await saveMediaBytes(key,image.data);written.push({namespace:asset.storage_namespace,key});
      variants.push({variant:image.variant,key,mime:"image/webp",size:image.data.length,width:image.width,height:image.height});
     }
     return variants;
    });
    written.length=0;
   }finally{for(const file of written)await removeMediaBytes(file.namespace,file.key);}
  }
  console.log(JSON.stringify({processed:rows.length,generated,limit,note:"Repeat until processed is zero. Existing ready variants are skipped."}));
 }
}catch(error){console.error(error instanceof Error?error.message:"Responsive media generation failed");process.exitCode=1;}
finally{await release?.();await getPool().end();}
