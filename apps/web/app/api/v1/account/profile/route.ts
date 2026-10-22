import {profileService} from "@/lib/profiles";
import {checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request){try{return Response.json(await profileService.readOwn(request.headers),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request){try{checkWriteOrigin(request);return Response.json(await profileService.updateOwn(request.headers,await readJson(request)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
