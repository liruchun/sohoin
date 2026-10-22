import {getUnreadNotificationCount,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request){try{return Response.json(await getUnreadNotificationCount(request.headers),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
