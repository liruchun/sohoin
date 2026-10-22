import {getPublicMediaResponse,errorResponse,ServiceError} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{key:string[]}>}){
 try{
  const query=new URL(request.url).searchParams;
  if([...query.keys()].some(key=>key!=="variant")||query.getAll("variant").length>1||(query.has("variant")&&!["thumbnail","w480","w960","w1440"].includes(query.get("variant")!)))throw new ServiceError(400,"INVALID_MEDIA_VARIANT","图片规格无效");
  return await getPublicMediaResponse(request,(await params).key.join("/"),query.get("variant")??false);
 }catch(error){return errorResponse(error);}
}

export const HEAD=GET;
