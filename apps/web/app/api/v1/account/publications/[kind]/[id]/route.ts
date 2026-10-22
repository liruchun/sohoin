import {getOwnPublication,updateOwnPublication,checkWriteOrigin,readJson,errorResponse} from '@sohoin/core/server';
type Context={params:Promise<{kind:string;id:string}>};
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
export async function GET(request:Request,{params}:Context){try{const {kind,id}=await params;return Response.json(await getOwnPublication(request.headers,kind,id),{headers});}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request,{params}:Context){try{checkWriteOrigin(request);const {kind,id}=await params;return Response.json(await updateOwnPublication(request.headers,kind,id,await readJson(request,65536)),{headers});}catch(error){return errorResponse(error);}}
