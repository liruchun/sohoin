import {listSettingsAudit,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const params=new URL(request.url).searchParams;return Response.json(await listSettingsAudit(request.headers,{...(params.has("before")?{before:params.get("before")}:{} )}),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
