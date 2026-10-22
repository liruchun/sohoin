import {getOwnBookmarks,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request,{params}:{params:Promise<{kind:string}>}){try{return Response.json(await getOwnBookmarks(request.headers,(await params).kind,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
