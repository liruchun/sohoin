import {profileService} from "@/lib/profiles";
import {errorResponse} from "@sohoin/core/server";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await profileService.readPublic((await params).id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
