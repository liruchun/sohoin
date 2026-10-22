import {createAdminBadgeService,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
  const {userId,...query}=Object.fromEntries(new URL(request.url).searchParams);
  return Response.json(await createAdminBadgeService(request.headers).listOptions(userId,query),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
