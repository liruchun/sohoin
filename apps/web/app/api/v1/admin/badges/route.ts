import {createAdminBadgeService,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
  return Response.json(await createAdminBadgeService(request.headers).listDefinitions(Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{
  checkWriteOrigin(request);
  return Response.json(await createAdminBadgeService(request.headers).createManagedDefinition(await readJson(request,8192)),{status:201,headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
