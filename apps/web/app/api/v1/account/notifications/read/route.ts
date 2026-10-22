import {readNotificationsAction,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export async function PATCH(request:Request){try{checkWriteOrigin(request);return Response.json(await readNotificationsAction(request.headers,await readJson(request)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
