import {getSiteContent,getSiteInteractions,ServiceError,errorResponse} from "@sohoin/core/server";

export async function GET(_request:Request,{params}:{params:Promise<{type:string;id:string}>}){
 let response:Response;
 try{
  const {type,id}=await params;
  if(type!=="post"&&type!=="article"&&type!=="comment")throw new ServiceError(404,"PUBLIC_PAGE_NOT_FOUND","内容不存在或未公开");
  const [content,viewer]=await Promise.all([getSiteContent(id,type),type==="comment"?Promise.resolve({items:[]}):getSiteInteractions(_request.headers,{ids:[id]})]);
  response=Response.json({content:{...content,interaction:viewer.items[0]}});
 }catch(error){response=errorResponse(error);}
 response.headers.set("Cache-Control","private, no-store");
 response.headers.set("X-Robots-Tag","noindex");
 return response;
}
