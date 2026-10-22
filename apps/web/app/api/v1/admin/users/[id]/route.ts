import {getUser,updateUser,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{
  return Response.json(await getUser(request.headers,(await params).id),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request,{params}:Context){try{
  checkWriteOrigin(request);
  return Response.json(await updateUser(request.headers,(await params).id,await readJson(request,4096)),{headers:{"Cache-Control":"no-store"}});
}catch(error){return errorResponse(error);}}
