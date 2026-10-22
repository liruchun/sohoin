import {contentService} from "@/lib/content";
import {checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return Response.json(await contentService.list(request.headers,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{checkWriteOrigin(request);return Response.json(await contentService.create(request.headers,await readJson(request,262144)),{status:201,headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
