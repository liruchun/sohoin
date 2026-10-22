import {listNotifications,errorResponse} from "@sohoin/core/server";
export async function GET(request:Request){try{return Response.json(await listNotifications(request.headers,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
