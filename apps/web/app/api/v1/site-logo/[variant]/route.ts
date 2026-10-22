import {getSiteLogo,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{variant:string}>}){
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; sandbox","Cross-Origin-Resource-Policy":"same-origin","Content-Disposition":"inline"};
 try{const file=await getSiteLogo((await params).variant);return new Response(new Uint8Array(file.bytes),{headers:{...headers,"Content-Type":file.mime}});}catch(error){const response=errorResponse(error);for(const [key,value] of Object.entries(headers))response.headers.set(key,value);return response;}
}
