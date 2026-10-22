import {generateIconsSchema} from "@sohoin/extension-api/media";
import {generateSiteIcons,checkWriteOrigin,readJson,errorResponse,ServiceError} from "@sohoin/core/server";
export const runtime="nodejs";
export async function POST(request:Request){
 try{checkWriteOrigin(request);const input=generateIconsSchema.safeParse(await readJson(request,1024));if(!input.success)throw new ServiceError(400,"INVALID_ICON_SOURCE","请选择有效的来源图片");return Response.json(await generateSiteIcons(request.headers,input.data.mediaId),{status:201,headers:{"Cache-Control":"no-store"}});}
 catch(error){return errorResponse(error);}
}
