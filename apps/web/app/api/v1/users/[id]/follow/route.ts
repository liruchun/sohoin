import {setFollow,checkWriteOrigin,readJson,errorResponse} from "@sohoin/core/server";
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){try{checkWriteOrigin(request);return Response.json(await setFollow(request.headers,(await params).id,await readJson(request)),{headers:{"Cache-Control":"no-store"}});}catch(error){return errorResponse(error);}}
