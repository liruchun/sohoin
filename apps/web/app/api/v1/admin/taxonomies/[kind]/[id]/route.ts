import {contentService} from "@/lib/content";
import {checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{kind:string;id:string}>};
export async function GET(request:Request,{params}:Context){try{const {kind,id}=await params;return Response.json(await contentService.term(request.headers,kind,id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request,{params}:Context){try{checkWriteOrigin(request);const {kind,id}=await params;return Response.json(await contentService.updateTerm(request.headers,kind,id,await readJson(request,4096)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function DELETE(request:Request,{params}:Context){try{checkWriteOrigin(request);const {kind,id}=await params;return Response.json(await contentService.removeTerm(request.headers,kind,id,await readJson(request,4096)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
