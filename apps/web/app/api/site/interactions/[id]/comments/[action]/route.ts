import {setSiteCommentInteraction,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";

export async function PUT(request:Request,{params}:{params:Promise<{id:string;action:string}>}){
 let response:Response;
 try{
  checkWriteOrigin(request);
  const {id,action}=await params;
  response=Response.json(await setSiteCommentInteraction(request.headers,id,action,await readJson(request,1024)));
 }catch(error){response=errorResponse(error);}
 response.headers.set("Cache-Control","private, no-store");
 response.headers.set("X-Robots-Tag","noindex");
 return response;
}
