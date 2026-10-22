import {getSiteIcon,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{variant:string}>}){
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex","Content-Security-Policy":"default-src 'none'; sandbox"};
 try{const file=await getSiteIcon((await params).variant);return new Response(new Uint8Array(file.bytes),{headers:{...headers,"Content-Type":file.mime}});}
 catch(error){const response=errorResponse(error);for(const [key,value] of Object.entries(headers))response.headers.set(key,value);return response;}
}
