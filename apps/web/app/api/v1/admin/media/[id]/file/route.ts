import {SITE_ICON_SIZES} from "@sohoin/extension-api/media-limits";
import {getAdminMediaResponse,errorResponse,ServiceError} from "@sohoin/core/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{const query=new URL(request.url).searchParams;if([...query.keys()].some(key=>key!=="variant")||(query.has("variant")&&!["thumbnail","logo",...Object.keys(SITE_ICON_SIZES)].includes(query.get("variant")!)))throw new ServiceError(400,"INVALID_MEDIA_VARIANT","图片规格无效");return await getAdminMediaResponse(request,(await params).id,query.get("variant")==="thumbnail"?true:query.get("variant")??false);}catch(error){return errorResponse(error);}}

export const HEAD=GET;
