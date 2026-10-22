import {contentService} from "@/lib/content";
import {errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await contentService.getPublic((await params).id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
