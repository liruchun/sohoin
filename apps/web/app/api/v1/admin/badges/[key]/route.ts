import {createAdminBadgeService,checkWriteOrigin,readJson,errorResponse,ServiceError} from "@sohoin/core/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{key:string}>};
export async function GET(request:Request,{params}:Context){try{
  return Response.json(await createAdminBadgeService(request.headers).getDefinition((await params).key),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request,{params}:Context){try{
  checkWriteOrigin(request);
  const key=(await params).key,body=await readJson(request,8192);
  if(!body||typeof body!=="object"||Array.isArray(body)||("key" in body&&body.key!==key))throw new ServiceError(400,"INVALID_BADGE_INPUT","勋章参数无效");
  return Response.json(await createAdminBadgeService(request.headers).updateDefinition({...body,key}),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
