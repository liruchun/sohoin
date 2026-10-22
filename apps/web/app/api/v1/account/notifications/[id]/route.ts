import {getNotification,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await getNotification(request.headers,(await params).id),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
