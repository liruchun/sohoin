import {createAdminBadgeService,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{
  checkWriteOrigin(request);
  return Response.json(await createAdminBadgeService(request.headers).grantManually(await readJson(request,8192)),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request){try{
  checkWriteOrigin(request);
  return Response.json(await createAdminBadgeService(request.headers).revokeManually(await readJson(request,8192)),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
