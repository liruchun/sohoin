import {getOwnFollows,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request,{params}:{params:Promise<{direction:string}>}){try{return Response.json(await getOwnFollows(request.headers,(await params).direction,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
