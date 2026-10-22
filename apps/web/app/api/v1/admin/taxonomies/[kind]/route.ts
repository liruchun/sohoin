import {contentService} from "@/lib/content";
import {checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{kind:string}>};
export async function GET(request:Request,{params}:Context){try{return Response.json(await contentService.terms(request.headers,(await params).kind,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
export async function POST(request:Request,{params}:Context){try{checkWriteOrigin(request);return Response.json(await contentService.createTerm(request.headers,(await params).kind,await readJson(request,4096)),{status:201,headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
