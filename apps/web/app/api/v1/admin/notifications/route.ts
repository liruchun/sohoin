import {sendNotification,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export async function POST(request:Request){try{checkWriteOrigin(request);return Response.json(await sendNotification(request.headers,await readJson(request)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
