import {contentService} from "@/lib/content";
import {checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{return Response.json(await contentService.get(request.headers,(await params).id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request,{params}:Context){try{checkWriteOrigin(request);return Response.json(await contentService.update(request.headers,(await params).id,await readJson(request,262144)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function DELETE(request:Request,{params}:Context){try{checkWriteOrigin(request);return Response.json(await contentService.remove(request.headers,(await params).id,await readJson(request,4096)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
