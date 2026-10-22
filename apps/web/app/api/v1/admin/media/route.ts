import {listMedia,uploadMediaRequest,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){try{return Response.json(await listMedia(request.headers,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{return Response.json(await uploadMediaRequest(request),{status:201,headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
