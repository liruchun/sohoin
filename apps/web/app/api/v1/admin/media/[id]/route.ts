import {deleteMedia,getMediaDetail,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await getMediaDetail(request.headers,(await params).id,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{checkWriteOrigin(request);return Response.json(await deleteMedia(request.headers,(await params).id,await readJson(request)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
