import "server-only";
import {readPublicRouteIds,savePublicRouteIds} from "@sohoin/database";
import {createShortPublicId} from "./public-id";
export async function publicRoutes(contents:string[],users:string[]){
 const contentIds=[...new Set(contents)],userIds=[...new Set(users)];if(contentIds.length+userIds.length>100)throw new Error("Public route batch exceeded");
 const requested=[...contentIds.map(id=>({kind:"content" as const,id})),...userIds.map(id=>({kind:"user" as const,id}))];
 for(let attempt=0;attempt<8;attempt++){
  const rows=await readPublicRouteIds(contentIds,userIds),known=new Set(rows.map(r=>r.kind+":"+r.id));
  const fresh=requested.filter(r=>!known.has(r.kind+":"+r.id)).map(r=>({kind:r.kind,content_id:r.kind==="content"?r.id:null,user_id:r.kind==="user"?r.id:null,token:createShortPublicId()}));
  if(!fresh.length)return new Map(rows.map(r=>[r.kind+":"+r.id,r.token]));
  try{await savePublicRouteIds(fresh);}catch(error){const e=error as {code?:string;constraint?:string};if(e.code!=="23505"||e.constraint!=="public_route_ids_short_id_key")throw error;}
 }
 throw new Error("Unable to allocate unique public route IDs");
}
