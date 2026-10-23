import {getSiteFollow,setSiteFollow,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";

type Context={params:Promise<{id:string}>};
async function handle(request:Request,{params}:Context,write:boolean){
 let response:Response;
 try{
  if(write)checkWriteOrigin(request);
  const {id}=await params;
  response=Response.json(write
   ?await setSiteFollow(request.headers,id,await readJson(request,1024))
   :await getSiteFollow(request.headers,id));
 }catch(error){response=errorResponse(error);}
 response.headers.set("Cache-Control","private, no-store");
 response.headers.set("X-Robots-Tag","noindex");
 return response;
}
export async function GET(request:Request,context:Context){return handle(request,context,false);}
export async function PUT(request:Request,context:Context){return handle(request,context,true);}
