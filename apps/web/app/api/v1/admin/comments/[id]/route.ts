import {getCommentContext,moderateComment,errorResponse,checkWriteOrigin,readJson} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await getCommentContext(request.headers,(await params).id,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{checkWriteOrigin(request);return Response.json(await moderateComment(request.headers,(await params).id,await readJson(request)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
