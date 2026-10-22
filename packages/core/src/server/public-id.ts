import "server-only";
import {createCipheriv,createDecipheriv,randomBytes,randomInt} from "node:crypto";
/** AES-256-GCM with random 96-bit nonces and purpose-bound authentication. The AAD keeps its original "sohodoor" prefix so already-issued public IDs stay valid across renames. */
export function createPublicIdCodec(secret:string){
 const key=Buffer.from(secret,"base64url");if(key.length!==32||key.toString("base64url")!==secret)throw new Error("PUBLIC_ID_SECRET must be 32 random base64url bytes");
 return {
  seal(purpose:"content"|"user"|"cursor",value:string){if(!value||Buffer.byteLength(value)>128)throw new Error("Invalid public ID payload");const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);cipher.setAAD(Buffer.from("sohodoor:public-id:v1:"+purpose));const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return "d1_"+Buffer.concat([iv,encrypted,cipher.getAuthTag()]).toString("base64url");},
  open(purpose:"content"|"user"|"cursor",token:string){try{if(!/^d1_[A-Za-z0-9_-]{39,220}$/.test(token))return null;const bytes=Buffer.from(token.slice(3),"base64url");if(bytes.toString("base64url")!==token.slice(3))return null;const cipher=createDecipheriv("aes-256-gcm",key,bytes.subarray(0,12));cipher.setAAD(Buffer.from("sohodoor:public-id:v1:"+purpose));cipher.setAuthTag(bytes.subarray(-16));return Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString("utf8");}catch{return null;}}
 };
}
export function publicIdCodec(){const secret=process.env.PUBLIC_ID_SECRET;if(!secret)throw new Error("Configure PUBLIC_ID_SECRET");return createPublicIdCodec(secret);}

const alphabet="0123456789abcdefghijklmnopqrstuvwxyz";
/** Fixed 10-character lowercase Base36 ID; reject all-digit values to keep public URLs opaque. */
export function createShortPublicId():string {
 let id="";for(let i=0;i<10;i++)id+=alphabet[randomInt(alphabet.length)];
 return /[a-z]/.test(id)?id:createShortPublicId();
}
