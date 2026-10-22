import {settingsService} from "@/lib/settings";
import {checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return Response.json(await settingsService.readAdmin(request.headers),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request){try{checkWriteOrigin(request);const body=await readJson(request);return Response.json(await settingsService.update(request.headers,body),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
