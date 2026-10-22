import {getOwnMedals,wearOwnBadge,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";

export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams;
  return Response.json(await getOwnMedals(request.headers,Object.fromEntries(params)),{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
export async function PATCH(request:Request){
 try{
  checkWriteOrigin(request);
  return Response.json(await wearOwnBadge(request.headers,await readJson(request,1024)),{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
