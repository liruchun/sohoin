import {listUsers,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{
  return Response.json(await listUsers(request.headers,Object.fromEntries(new URL(request.url).searchParams)),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
