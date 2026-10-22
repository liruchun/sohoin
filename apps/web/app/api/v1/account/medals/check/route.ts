import {checkOwnAchievements,getOwnMedals,checkWriteOrigin,readJson,errorResponse,ServiceError} from "@sohoin/core/server";

export async function POST(request:Request){
 try{
  checkWriteOrigin(request);
  const input=await readJson(request,128);
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length)throw new ServiceError(400,"INVALID_ACHIEVEMENT_INPUT","成就核对不接受用户或计数参数");
  const result=await checkOwnAchievements(request.headers);
  return Response.json({...result,collection:await getOwnMedals(request.headers)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return errorResponse(error);}
}
