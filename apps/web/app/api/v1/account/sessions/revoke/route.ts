import {revokeAccountSessions,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export async function POST(request:Request){try{checkWriteOrigin(request);return Response.json(await revokeAccountSessions(request.headers,await readJson(request,4096)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
