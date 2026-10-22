import {profileService} from "@/lib/profiles";
import {checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await profileService.readAdmin(request.headers,(await params).id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{checkWriteOrigin(request);return Response.json(await profileService.updateAdmin(request.headers,(await params).id,await readJson(request)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
